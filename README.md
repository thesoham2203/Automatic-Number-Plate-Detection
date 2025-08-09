# ANPR Toll Collection System

## Overview

This is a **production-ready** Automatic Number Plate Recognition (ANPR) system designed for modern toll collection operations. The system combines advanced computer vision, enterprise-grade web interfaces, and automated hardware integration to provide a complete toll collection solution with real-time processing capabilities.

## 🚀 Key Features

- **Advanced Computer Vision**: OpenCV + EasyOCR with multi-algorithm plate detection
- **High Accuracy Recognition**: Confidence scoring with validation and error handling
- **Real-time Processing**: FastAPI backend with asynchronous video processing
- **Multiple Detection Methods**: Combines edge detection, contour analysis, and ML models
- **Performance Optimized**: CPU and GPU acceleration support

### Modern Enterprise Web Interface

- **React 19 + TypeScript**: Professional, responsive UI with modern design
- **Real-time Updates**: Live progress tracking and processing status
- **Results Dashboard**: Confidence visualization, detection summaries, and detailed analytics
- **Mobile Responsive**: Optimized for desktop, tablet, and mobile devices
- **Accessibility**: WCAG 2.1 compliant interface design

### Complete Toll Management System

- **Automated Payment Processing**: Integrated with vehicle registration database
- **Dynamic Pricing Engine**: Vehicle type detection with peak-hour pricing
- **Account Management**: Real-time balance tracking and transaction history
- **Hardware Integration**: Automated barrier control and sensor monitoring
- **Violation Management**: Automated enforcement and notification system

### Enterprise Architecture

- **Microservices Design**: Scalable FastAPI backend with Celery task processing
- **Production Logging**: Structured logging with rotation and monitoring
- **Robust Error Handling**: Comprehensive error recovery and retry mechanisms
- **Health Monitoring**: Built-in health checks and performance metrics
- **Security Ready**: API authentication, rate limiting, and data encryption
- **Cloud Native**: Docker-ready with load balancing and scaling support

## 🏗️ System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Hardware      │    │   Backend       │    │   Frontend      │
│                 │    │                 │    │                 │
│ • HD Camera     │───▶│ • FastAPI       │───▶│ • React 19      │
│ • Sensors       │    │ • Python 3.10   │    │ • TypeScript    │
│ • Barriers      │    │ • OpenCV        │    │ • Modern UI     │
│ • Node.js Mon   │    │ • EasyOCR       │    │ • Responsive    │
│ • FFmpeg        │    │ • Virtual Env   │    │ • Real-time     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌─────────────────┐              │
         │              │   Processing    │              │
         └──────────────│                 │──────────────┘
                        │ • File System   │
                        │ • Task Queue    │
                        │ • Results Store │
                        │ • Logs & Metrics│
                        └─────────────────┘

Production Deployment:
• Backend API: Port 8001 (FastAPI + Uvicorn)
• Frontend UI: Port 3000 (React Development Server)
• Hardware Monitor: Node.js File Watcher + FFmpeg Processing
• Video Processing: Python Virtual Environment with OpenCV/EasyOCR
```

## 🛠️ Installation & Setup

### Prerequisites

**Hardware (Production Deployment):**

- High-definition camera (1080p+ recommended)
- Computer with Windows 10/11 or Linux
- USB Webcam or IP Camera
- Ultrasonic sensor for vehicle detection
- RFID reader (optional backup)
- Relay module for barrier control
- Adequate lighting for plate recognition

**Software Requirements:**

- **Node.js 16+** and npm (for hardware monitoring)
- **Python 3.10+** with pip (backend processing)
- **FFmpeg** (video processing)
- **Git** (version control)
- **Modern web browser** (Chrome, Firefox, Safari, Edge)

### Quick Start (Production Ready)

1. **Clone the repository:**

```bash
git clone https://github.com/thesoham2203/Automatic-Number-Plate-Detection.git
cd Automatic-Number-Plate-Detection
```

2. **Setup Python Virtual Environment:**

```bash
# Create and activate virtual environment
python -m venv .venv

# Windows
.venv\Scripts\activate

# Linux/Mac
source .venv/bin/activate
```

### Backend Setup

1. **Install Python dependencies:**

```bash
cd backend
pip install -r requirements.txt
```

2. **Install FFmpeg (if not already installed):**

```bash
# Windows (using winget)
winget install Gyan.FFmpeg

# Linux (Ubuntu/Debian)
sudo apt update && sudo apt install ffmpeg

# macOS (using Homebrew)
brew install ffmpeg
```

3. **Start the FastAPI server:**

```bash
# From the backend directory
python main.py

# Or using uvicorn directly
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

**✅ Backend will be running at:** `http://localhost:8001`

### Frontend Setup

1. **Install Node.js dependencies:**

```bash
cd frontend
npm install
```

2. **Start the React development server:**

```bash
npm start
```

**✅ Frontend will be running at:** `http://localhost:3000`

### Hardware Integration Setup

1. **Install Node.js dependencies (root directory):**

```bash
# From the root project directory
npm install
```

2. **Start the hardware monitoring system:**

```bash
node watchVideo.js
```

**✅ Hardware monitoring will watch for vehicle triggers and process videos automatically**

## 🚀 Complete System Launch

### Start All Services (Production)

**Terminal 1 - Backend API:**

```bash
cd backend
python main.py
```

**Terminal 2 - Frontend UI:**

```bash
cd frontend
npm start
```

**Terminal 3 - Hardware Monitor:**

```bash
node watchVideo.js
```

### System Status Check

- **Backend API:** http://localhost:8001/docs (Interactive API documentation)
- **Frontend UI:** http://localhost:3000 (Main operator interface)
- **API Health:** http://localhost:8001/ (System status endpoint)

## 🚗 Usage

### For Toll Operators

1. **Main Interface:** Access the React frontend at `http://localhost:3000`
2. **Upload Videos:**
   - Drag and drop video files for batch processing
   - Supported formats: MP4, AVI, MOV, H.264
   - Real-time upload progress tracking
3. **Monitor Processing:**
   - Live status updates during video analysis
   - Progress bars with time estimates
   - Processing queue management
4. **View Results:**
   - Detailed plate detection results with confidence scores
   - Frame-by-frame analysis with detected regions
   - Export options for reports and compliance
5. **System Management:**
   - Task history and processing logs
   - Performance metrics and system health

### For Real-Time Operations

1. **Automatic Processing:**
   - Vehicle detection triggers automatic video capture
   - H.264 video conversion to MP4 format
   - Frame extraction and ANPR analysis
2. **Toll Collection:**
   - Automatic license plate recognition
   - Database lookup for vehicle registration
   - Real-time toll calculation and payment processing
3. **Hardware Control:**
   - Automated barrier operation
   - Sensor monitoring and status reporting
   - Violation detection and alerting

### For System Integration

1. **RESTful API:** Complete API for integration with existing toll systems
2. **Real-time Events:** Live processing status and completion notifications
3. **Data Export:** Direct access to detection results and transaction data
4. **Health Monitoring:** Built-in system health and performance endpoints

## 📊 API Documentation

The system provides a complete RESTful API for integration and automation.

### Main Endpoints

| Endpoint                    | Method | Description                   | Response        |
| --------------------------- | ------ | ----------------------------- | --------------- |
| `/`                         | GET    | System status and information | System metadata |
| `/docs`                     | GET    | Interactive API documentation | Swagger UI      |
| `/api/v1/process-video`     | POST   | Upload and process video      | Task creation   |
| `/api/v1/status/{task_id}`  | GET    | Get processing status         | Status details  |
| `/api/v1/results/{task_id}` | GET    | Get detailed results          | ANPR results    |
| `/api/v1/tasks`             | GET    | List all processing tasks     | Task list       |
| `/api/v1/tasks/{task_id}`   | DELETE | Delete a task                 | Confirmation    |

### Example API Usage

**Upload and Process Video:**

```javascript
const formData = new FormData();
formData.append("file", videoFile);

const response = await fetch("http://localhost:8001/api/v1/process-video", {
  method: "POST",
  body: formData,
});

const result = await response.json();
console.log("Task ID:", result.task_id);
```

**Check Processing Status:**

```javascript
const statusResponse = await fetch(
  `http://localhost:8001/api/v1/status/${result.task_id}`
);
const status = await statusResponse.json();
console.log("Status:", status.status);
console.log("Progress:", status.progress);
```

**Get Results:**

```javascript
const resultsResponse = await fetch(
  `http://localhost:8001/api/v1/results/${result.task_id}`
);
const results = await resultsResponse.json();
console.log("Detected plates:", results.detected_plates);
console.log("Confidence scores:", results.confidence_scores);
```

## 🔧 Configuration

### System Configuration

The system works out-of-the-box with minimal configuration. For advanced setups:

**Backend Configuration (`backend/main.py`):**

- FastAPI settings and CORS configuration
- File upload limits and processing parameters
- Task management and cleanup settings

**Frontend Configuration (`frontend/src/setupProxy.js`):**

- API proxy settings for development
- Backend URL configuration

**Hardware Configuration (`watchVideo.js`):**

- FFmpeg processing parameters
- Video file monitoring settings
- Frame extraction configuration

### Environment Variables (Optional)

For production deployments, create environment variables:

```env
# Processing Settings
VIDEO_PROCESSING_TIMEOUT=300
MAX_FILE_SIZE_MB=500
FRAMES_PER_SECOND=1

# Hardware Settings
CAMERA_RESOLUTION=1920x1080
VIDEO_DURATION=10000
SENSOR_SENSITIVITY=high

# API Settings
API_PORT=8001
FRONTEND_PORT=3000
CORS_ORIGINS=http://localhost:3000

# Logging
LOG_LEVEL=INFO
LOG_ROTATION=daily
```

## 🚀 Deployment

### Production Deployment

**Method 1: Direct Deployment**

```bash
# Start backend API server
cd backend
python main.py

# Start frontend (new terminal)
cd frontend
npm run build
npm run start

# Start hardware monitoring (new terminal)
node watchVideo.js
```

**Method 2: Using Process Managers**

```bash
# Using PM2 for Node.js processes
npm install -g pm2

# Start all services
pm2 start watchVideo.js --name "anpr-hardware"
pm2 start "npm run start" --cwd ./frontend --name "anpr-frontend"

# Backend can be managed with systemd or similar
```

### System URLs (Production)

- **Main Application:** http://localhost:3000
- **API Documentation:** http://localhost:8001/docs
- **API Health Check:** http://localhost:8001/
- **Hardware Monitor:** File watcher service (background)

### Performance Optimization

**Backend Performance:**

- Python virtual environment with optimized packages
- Asynchronous request handling with FastAPI
- Efficient file processing with temporary storage cleanup

**Frontend Performance:**

- React 19 with modern optimization
- Responsive design with efficient rendering
- Real-time updates without polling overhead

**Video Processing:**

- FFmpeg hardware acceleration (when available)
- Optimized frame extraction rates
- Memory-efficient processing pipeline

## 🧪 Testing

### Manual Testing

**Frontend Testing:**

1. Open http://localhost:3000
2. Upload a test video file
3. Monitor processing progress
4. Verify results display correctly

**API Testing:**

```bash
# Test API health
curl http://localhost:8001/

# Test video upload
curl -X POST -F "file=@test-video.mp4" http://localhost:8001/api/v1/process-video

# Test status check
curl http://localhost:8001/api/v1/tasks
```

**Hardware Testing:**

1. Place test.h264 file in root directory
2. Trigger system: `echo "test" > flag.txt`
3. Verify video processing and frame extraction
4. Check html/output.mp4 and html/frames/ directory

### System Validation

**Video Processing Pipeline:**

- ✅ H.264 input file detection
- ✅ FFmpeg conversion to MP4
- ✅ Frame extraction to PNG files
- ✅ ANPR analysis on extracted frames
- ✅ Results compilation and storage

**API Functionality:**

- ✅ File upload handling
- ✅ Task creation and tracking
- ✅ Status reporting
- ✅ Results retrieval
- ✅ Error handling and validation

## 📝 Monitoring & Logging

### Log Files

The system generates comprehensive logs for monitoring and debugging:

- **Backend API:** `backend/logs/` (API requests, processing status)
- **Hardware Monitor:** Console output (file watching, FFmpeg processing)
- **Frontend:** Browser console (user interactions, API calls)
- **Processing:** Task-specific logs (ANPR analysis, errors)

### Monitoring Endpoints

| Endpoint            | Purpose                    | Example Response                                |
| ------------------- | -------------------------- | ----------------------------------------------- |
| `GET /`             | System health and version  | `{"status": "operational", "version": "1.0.0"}` |
| `GET /docs`         | API documentation          | Interactive Swagger UI                          |
| `GET /api/v1/tasks` | Active and completed tasks | Task list with statistics                       |

### System Status Dashboard

Access the main dashboard at http://localhost:3000 for:

- Real-time processing status
- Task queue monitoring
- System performance metrics
- Error logs and alerts

## 🛠️ Troubleshooting

### Common Issues & Solutions

**1. Backend API not starting:**

```bash
# Check Python environment
python --version  # Should be 3.10+

# Verify virtual environment
source .venv/bin/activate  # Linux/Mac
.venv\Scripts\activate     # Windows

# Check dependencies
pip list | grep fastapi
```

**2. Frontend compilation errors:**

```bash
# Clear npm cache
npm cache clean --force

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

**3. FFmpeg not found:**

```bash
# Windows: Install FFmpeg
winget install Gyan.FFmpeg

# Linux: Install FFmpeg
sudo apt install ffmpeg

# Verify installation
ffmpeg -version
```

**4. Video processing failures:**

```bash
# Check video format support
ffmpeg -formats | grep mp4

# Test file permissions
ls -la test.h264

# Verify output directories exist
mkdir -p html/frames
```

**5. ANPR accuracy issues:**

- Ensure good lighting conditions
- Check camera focus and angle
- Verify video resolution (1080p+ recommended)
- Clean camera lens and license plates

### Performance Optimization

**Slow processing:**

- Check available system memory
- Verify CPU usage during processing
- Consider reducing video resolution
- Enable hardware acceleration if available

**High memory usage:**

- Monitor file sizes and processing limits
- Clear temporary files regularly
- Restart services if memory leaks occur

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🎯 Roadmap & Future Enhancements

### Version 2.0 (Planned)

- [ ] **Machine Learning Enhancement**

  - Custom model training interface
  - Region-specific plate recognition models
  - Improved accuracy with deep learning

- [ ] **Advanced Analytics**

  - Real-time analytics dashboard
  - Traffic pattern analysis
  - Revenue reporting and insights

- [ ] **Mobile Integration**

  - Mobile app for toll operators
  - Push notifications for violations
  - Remote system monitoring

- [ ] **Multi-Language Support**

  - International license plate formats
  - Multi-region character recognition
  - Localized user interfaces

- [ ] **Enterprise Features**
  - Advanced violation detection
  - Integration with law enforcement systems
  - Multi-site management capabilities

### Current System Status

**✅ Production Ready Features:**

- Complete ANPR processing pipeline
- Modern web interface with React 19
- Real-time video processing with FFmpeg
- FastAPI backend with comprehensive error handling
- Hardware integration for automated toll collection
- File-based task management and result storage

**🔧 Technical Implementation:**

- Python 3.10+ with virtual environment
- Node.js hardware monitoring system
- TypeScript frontend with responsive design
- OpenCV + EasyOCR computer vision stack
- Cross-platform compatibility (Windows/Linux/macOS)

---

**🚀 Built for Production Toll Collection Systems**

_A complete, enterprise-ready ANPR solution with modern web technologies and robust hardware integration._
