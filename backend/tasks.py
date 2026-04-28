
from celery import Celery
from celery.utils.log import get_task_logger
from anpr import ANPR
import os
import logging
from datetime import datetime
from typing import Dict, Any

# Configure Celery
celery_app = Celery(
    "anpr_tasks", 
    broker="redis://localhost:6379/0", 
    backend="redis://localhost:6379/0"
)

# Celery configuration
celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    task_track_started=True,
    task_time_limit=30 * 60,  # 30 minutes
    task_soft_time_limit=25 * 60,  # 25 minutes
    worker_prefetch_multiplier=1,
    task_acks_late=True,
    worker_disable_rate_limits=True
)

# Configure logging
logger = get_task_logger(__name__)

# Initialize ANPR system
anpr_system = ANPR()

@celery_app.task(bind=True, name='process_video_task')
def process_video_task(self, video_path: str, task_id: str = None) -> Dict[str, Any]:
    """
    Process video file for license plate detection.
    
    Args:
        self: Celery task instance
        video_path: Path to the video file
        task_id: Optional task identifier for tracking
        
    Returns:
        Dictionary containing processing results
    """
    try:
        logger.info(f"Starting video processing for task: {task_id}, file: {video_path}")
        
        # Update task state
        self.update_state(
            state='PROGRESS',
            meta={'message': 'Starting video analysis...', 'progress': 10}
        )
        
        # Check if file exists
        if not os.path.exists(video_path):
            raise FileNotFoundError(f"Video file not found: {video_path}")
        
        # Get file info
        file_size = os.path.getsize(video_path)
        logger.info(f"Processing video file: {video_path} (Size: {file_size} bytes)")
        
        # Update progress
        self.update_state(
            state='PROGRESS',
            meta={'message': 'Analyzing video frames...', 'progress': 30}
        )
        
        # Process video using ANPR system
        start_time = datetime.now()
        results = anpr_system.process_video(video_path)
        end_time = datetime.now()
        
        processing_time = (end_time - start_time).total_seconds()
        
        # Update progress
        self.update_state(
            state='PROGRESS',
            meta={'message': 'Finalizing results...', 'progress': 90}
        )
        
        # Enhance results with additional metadata
        enhanced_results = {
            **results,
            "task_metadata": {
                "task_id": task_id,
                "processing_time_seconds": processing_time,
                "file_path": video_path,
                "file_size_bytes": file_size,
                "processed_at": end_time.isoformat(),
                "worker_id": self.request.hostname
            }
        }
        
        # Log success
        plates_found = len(results.get("plates_detected", []))
        logger.info(
            f"Video processing completed successfully. "
            f"Task: {task_id}, Plates found: {plates_found}, "
            f"Processing time: {processing_time:.2f}s"
        )
        
        # Save results to file for backup
        if task_id:
            try:
                import json
                results_dir = "results"
                os.makedirs(results_dir, exist_ok=True)
                results_file = os.path.join(results_dir, f"{task_id}_results.json")
                
                with open(results_file, 'w') as f:
                    json.dump(enhanced_results, f, indent=2)
                    
                logger.info(f"Results saved to: {results_file}")
            except Exception as e:
                logger.warning(f"Could not save results to file: {e}")
        
        return enhanced_results
        
    except FileNotFoundError as e:
        error_msg = f"File not found: {str(e)}"
        logger.error(error_msg)
        self.update_state(
            state='FAILURE',
            meta={'error': error_msg, 'error_type': 'FileNotFoundError'}
        )
        raise
        
    except Exception as e:
        error_msg = f"Error processing video: {str(e)}"
        logger.error(error_msg, exc_info=True)
        
        # Clean up file if it exists
        try:
            if os.path.exists(video_path):
                os.remove(video_path)
                logger.info(f"Cleaned up video file: {video_path}")
        except Exception as cleanup_error:
            logger.warning(f"Could not clean up video file: {cleanup_error}")
        
        self.update_state(
            state='FAILURE',
            meta={'error': error_msg, 'error_type': type(e).__name__}
        )
        raise

@celery_app.task(name='health_check_task')
def health_check_task() -> Dict[str, Any]:
    """
    Health check task for monitoring system status.
    
    Returns:
        Dictionary containing system health information
    """
    try:
        logger.info("Performing health check...")
        
        # Check ANPR system
        anpr_healthy = hasattr(anpr_system, 'reader') and anpr_system.reader is not None
        
        # Check directories
        required_dirs = ['uploads', 'results', 'logs']
        dirs_status = {}
        
        for dir_name in required_dirs:
            try:
                os.makedirs(dir_name, exist_ok=True)
                dirs_status[dir_name] = "OK"
            except Exception as e:
                dirs_status[dir_name] = f"ERROR: {str(e)}"
        
        health_status = {
            "timestamp": datetime.now().isoformat(),
            "anpr_system": "OK" if anpr_healthy else "ERROR",
            "directories": dirs_status,
            "celery_worker": "OK",
            "overall_status": "HEALTHY" if anpr_healthy and all(
                status == "OK" for status in dirs_status.values()
            ) else "UNHEALTHY"
        }
        
        logger.info(f"Health check completed: {health_status['overall_status']}")
        return health_status
        
    except Exception as e:
        error_msg = f"Health check failed: {str(e)}"
        logger.error(error_msg, exc_info=True)
        return {
            "timestamp": datetime.now().isoformat(),
            "overall_status": "UNHEALTHY",
            "error": error_msg
        }

@celery_app.task(name='cleanup_old_files_task')
def cleanup_old_files_task(max_age_hours: int = 24) -> Dict[str, Any]:
    """
    Clean up old files from upload and results directories.
    
    Args:
        max_age_hours: Maximum age of files to keep (in hours)
        
    Returns:
        Dictionary containing cleanup results
    """
    try:
        logger.info(f"Starting cleanup of files older than {max_age_hours} hours")
        
        import time
        from pathlib import Path
        
        current_time = time.time()
        max_age_seconds = max_age_hours * 3600
        
        cleanup_results = {
            "timestamp": datetime.now().isoformat(),
            "max_age_hours": max_age_hours,
            "directories_cleaned": {},
            "total_files_removed": 0,
            "total_space_freed_mb": 0
        }
        
        # Directories to clean
        directories_to_clean = ['uploads', 'results', 'logs']
        
        for directory in directories_to_clean:
            if not os.path.exists(directory):
                continue
                
            dir_stats = {
                "files_removed": 0,
                "space_freed_mb": 0,
                "errors": []
            }
            
            try:
                for file_path in Path(directory).iterdir():
                    if file_path.is_file():
                        file_age = current_time - file_path.stat().st_mtime
                        
                        if file_age > max_age_seconds:
                            try:
                                file_size = file_path.stat().st_size
                                file_path.unlink()
                                
                                dir_stats["files_removed"] += 1
                                dir_stats["space_freed_mb"] += file_size / (1024 * 1024)
                                
                                logger.debug(f"Removed old file: {file_path}")
                                
                            except Exception as e:
                                error_msg = f"Could not remove {file_path}: {str(e)}"
                                dir_stats["errors"].append(error_msg)
                                logger.warning(error_msg)
                                
            except Exception as e:
                error_msg = f"Error accessing directory {directory}: {str(e)}"
                dir_stats["errors"].append(error_msg)
                logger.error(error_msg)
            
            cleanup_results["directories_cleaned"][directory] = dir_stats
            cleanup_results["total_files_removed"] += dir_stats["files_removed"]
            cleanup_results["total_space_freed_mb"] += dir_stats["space_freed_mb"]
        
        logger.info(
            f"Cleanup completed. Removed {cleanup_results['total_files_removed']} files, "
            f"freed {cleanup_results['total_space_freed_mb']:.2f} MB"
        )
        
        return cleanup_results
        
    except Exception as e:
        error_msg = f"Cleanup task failed: {str(e)}"
        logger.error(error_msg, exc_info=True)
        return {
            "timestamp": datetime.now().isoformat(),
            "status": "FAILED",
            "error": error_msg
        }

# Configure periodic tasks (if celery beat is used)
celery_app.conf.beat_schedule = {
    'health-check-every-5-minutes': {
        'task': 'health_check_task',
        'schedule': 300.0,  # 5 minutes
    },
    'cleanup-files-daily': {
        'task': 'cleanup_old_files_task',
        'schedule': 86400.0,  # 24 hours
        'kwargs': {'max_age_hours': 48}  # Keep files for 48 hours
    },
}

