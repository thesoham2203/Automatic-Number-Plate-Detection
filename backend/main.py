
from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks, Depends
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from celery.result import AsyncResult
from tasks import process_video_task
import os
import logging
import uuid
from datetime import datetime
from typing import Optional, Dict, Any
import mimetypes
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="ANPR Toll Collection System",
    description="Automatic Number Plate Recognition API for toll collection",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],  # Frontend URLs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security
security = HTTPBearer(auto_error=False)

# Create directories
UPLOAD_DIR = "uploads"
LOGS_DIR = "logs"
RESULTS_DIR = "results"

for directory in [UPLOAD_DIR, LOGS_DIR, RESULTS_DIR]:
    os.makedirs(directory, exist_ok=True)

# Configuration
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB
ALLOWED_VIDEO_TYPES = {
    'video/mp4', 'video/avi', 'video/mov', 'video/wmv', 
    'video/flv', 'video/webm', 'video/mkv', 'video/m4v'
}

# In-memory store for processing results (in production, use Redis/Database)
processing_results = {}

async def get_optional_token(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)):
    """Optional authentication for future use."""
    return credentials

def validate_video_file(file: UploadFile) -> bool:
    """Validate uploaded video file."""
    # Check MIME type
    if file.content_type not in ALLOWED_VIDEO_TYPES:
        return False
    
    # Check file extension
    if not file.filename:
        return False
        
    file_ext = Path(file.filename).suffix.lower()
    valid_extensions = {'.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv', '.m4v', '.h264'}
    
    return file_ext in valid_extensions

@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "message": "ANPR Toll Collection System API",
        "version": "1.0.0",
        "status": "operational",
        "endpoints": {
            "upload_video": "/api/v1/process-video",
            "check_status": "/api/v1/status/{task_id}",
            "get_results": "/api/v1/results/{task_id}",
            "health": "/api/v1/health"
        }
    }

@app.get("/api/v1/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "service": "ANPR API",
        "version": "1.0.0"
    }

@app.post("/api/v1/process-video")
async def process_video(
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    token: Optional[HTTPAuthorizationCredentials] = Depends(get_optional_token)
):
    """
    Upload and process video for license plate detection.
    
    Args:
        file: Video file to process
        background_tasks: FastAPI background tasks
        token: Optional authentication token
    
    Returns:
        JSON response with task ID
    """
    try:
        # Validate file
        if not file.filename:
            raise HTTPException(status_code=400, detail="No filename provided")
        
        if not validate_video_file(file):
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid file type. Supported formats: {', '.join(ALLOWED_VIDEO_TYPES)}"
            )
        
        # Check file size
        file_content = await file.read()
        if len(file_content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=413, 
                detail=f"File too large. Maximum size: {MAX_FILE_SIZE // (1024*1024)}MB"
            )
        
        # Generate unique task ID and filename
        task_id = str(uuid.uuid4())
        file_extension = Path(file.filename).suffix
        unique_filename = f"{task_id}{file_extension}"
        file_path = os.path.join(UPLOAD_DIR, unique_filename)
        
        # Save file
        with open(file_path, "wb") as buffer:
            buffer.write(file_content)
        
        logger.info(f"File uploaded: {unique_filename}, Size: {len(file_content)} bytes")
        
        # Start processing task
        task = process_video_task.delay(file_path, task_id)
        
        # Store initial result
        processing_results[task_id] = {
            "task_id": task_id,
            "status": "PENDING",
            "created_at": datetime.now().isoformat(),
            "filename": file.filename,
            "file_size": len(file_content),
            "celery_task_id": task.id
        }
        
        logger.info(f"Processing started for task: {task_id}")
        
        return JSONResponse({
            "task_id": task_id,
            "status": "PENDING",
            "message": "Video upload successful, processing started",
            "estimated_time": "2-5 minutes depending on video length"
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing video upload: {e}")
        raise HTTPException(status_code=500, detail="Internal server error during upload")

@app.get("/api/v1/status/{task_id}")
async def get_status(task_id: str):
    """
    Get processing status for a task.
    
    Args:
        task_id: Unique task identifier
    
    Returns:
        JSON response with task status and progress
    """
    try:
        # Check if task exists in our records
        if task_id not in processing_results:
            raise HTTPException(status_code=404, detail="Task not found")
        
        task_info = processing_results[task_id]
        celery_task_id = task_info.get("celery_task_id")
        
        if celery_task_id:
            # Get status from Celery
            task_result = AsyncResult(celery_task_id)
            status = task_result.status
            result = task_result.result
            
            # Update our record
            processing_results[task_id]["status"] = status
            processing_results[task_id]["last_updated"] = datetime.now().isoformat()
            
            response_data = {
                "task_id": task_id,
                "status": status,
                "created_at": task_info["created_at"],
                "last_updated": processing_results[task_id]["last_updated"],
                "filename": task_info["filename"]
            }
            
            if status == "SUCCESS":
                response_data["result_available"] = True
                response_data["message"] = "Processing completed successfully"
                if result:
                    response_data["summary"] = {
                        "plates_detected": len(result.get("plates_detected", [])),
                        "confidence_summary": result.get("confidence_summary", {})
                    }
            elif status == "FAILURE":
                response_data["error"] = str(result) if result else "Processing failed"
                response_data["message"] = "Processing failed"
            elif status == "PENDING":
                response_data["message"] = "Processing in progress..."
            elif status == "RETRY":
                response_data["message"] = "Processing retrying..."
            
            return JSONResponse(response_data)
        else:
            return JSONResponse({
                "task_id": task_id,
                "status": "UNKNOWN",
                "error": "No Celery task ID found"
            })
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting task status: {e}")
        raise HTTPException(status_code=500, detail="Error retrieving task status")

@app.get("/api/v1/results/{task_id}")
async def get_results(task_id: str):
    """
    Get detailed processing results for a completed task.
    
    Args:
        task_id: Unique task identifier
    
    Returns:
        JSON response with detailed ANPR results
    """
    try:
        if task_id not in processing_results:
            raise HTTPException(status_code=404, detail="Task not found")
        
        task_info = processing_results[task_id]
        celery_task_id = task_info.get("celery_task_id")
        
        if celery_task_id:
            task_result = AsyncResult(celery_task_id)
            
            if task_result.status != "SUCCESS":
                raise HTTPException(
                    status_code=400, 
                    detail=f"Task not completed successfully. Status: {task_result.status}"
                )
            
            result = task_result.result
            if not result:
                raise HTTPException(status_code=404, detail="No results available")
            
            # Enhanced response with additional metadata
            response_data = {
                "task_id": task_id,
                "status": "SUCCESS",
                "processing_completed_at": datetime.now().isoformat(),
                "input_file": task_info["filename"],
                "file_size_mb": round(task_info["file_size"] / (1024*1024), 2),
                "results": result,
                "toll_processing": {
                    "vehicle_detected": len(result.get("plates_detected", [])) > 0,
                    "primary_plate": result.get("plates_detected", [{}])[0] if result.get("plates_detected") else None,
                    "processing_recommendation": "PROCEED" if result.get("plates_detected") else "MANUAL_REVIEW"
                }
            }
            
            return JSONResponse(response_data)
        else:
            raise HTTPException(status_code=500, detail="No processing task found")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting results: {e}")
        raise HTTPException(status_code=500, detail="Error retrieving results")

@app.delete("/api/v1/tasks/{task_id}")
async def delete_task(task_id: str):
    """
    Delete a task and its associated data.
    
    Args:
        task_id: Unique task identifier
    
    Returns:
        JSON response confirming deletion
    """
    try:
        if task_id not in processing_results:
            raise HTTPException(status_code=404, detail="Task not found")
        
        # Remove from our records
        del processing_results[task_id]
        
        # Clean up any remaining files
        for directory in [UPLOAD_DIR, RESULTS_DIR]:
            for file_path in Path(directory).glob(f"{task_id}*"):
                try:
                    file_path.unlink()
                    logger.info(f"Cleaned up file: {file_path}")
                except Exception as e:
                    logger.warning(f"Could not delete file {file_path}: {e}")
        
        return JSONResponse({
            "message": f"Task {task_id} deleted successfully",
            "timestamp": datetime.now().isoformat()
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting task: {e}")
        raise HTTPException(status_code=500, detail="Error deleting task")

@app.get("/api/v1/tasks")
async def list_tasks():
    """
    List all processing tasks.
    
    Returns:
        JSON response with list of all tasks
    """
    try:
        tasks_summary = []
        for task_id, task_info in processing_results.items():
            tasks_summary.append({
                "task_id": task_id,
                "status": task_info.get("status", "UNKNOWN"),
                "created_at": task_info.get("created_at"),
                "filename": task_info.get("filename"),
                "file_size_mb": round(task_info.get("file_size", 0) / (1024*1024), 2)
            })
        
        return JSONResponse({
            "total_tasks": len(tasks_summary),
            "tasks": tasks_summary,
            "timestamp": datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error listing tasks: {e}")
        raise HTTPException(status_code=500, detail="Error retrieving task list")

# Error handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    """Custom HTTP exception handler."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
            "status_code": exc.status_code,
            "timestamp": datetime.now().isoformat()
        }
    )

@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    """General exception handler."""
    logger.error(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "status_code": 500,
            "timestamp": datetime.now().isoformat()
        }
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")

