# ANPR Toll Collection System

## Overview

This is an advanced Automatic Number Plate Recognition (ANPR) system designed for modern toll collection with RFID redundancy. The system combines IoT hardware, machine learning, and cloud technologies to automate vehicle identification and toll processing.

## 🚀 Key Features

### Enhanced ANPR Processing

- **Advanced Computer Vision**: Multi-method plate detection using Haar Cascades and contour analysis
- **Smart OCR**: EasyOCR with confidence scoring and text validation
- **Real-time Processing**: Celery-based asynchronous video processing
- **Multiple Detection Algorithms**: Combines different approaches for higher accuracy

### Modern Web Interface

- **React TypeScript Frontend**: Professional UI with real-time status updates
- **Progress Tracking**: Upload progress and processing status monitoring
- **Results Visualization**: Confidence bars, detection summaries, and detailed tables
- **Responsive Design**: Works on desktop, tablet, and mobile devices

### Comprehensive Toll Management

- **Automated Payment Processing**: Integration with vehicle registration database
- **Dynamic Toll Pricing**: Based on vehicle type and peak hours
- **Account Management**: Balance tracking and transaction history
- **Barrier Control**: Automated boom barrier operation
- **Violation Tracking**: Records and notifications for payment failures

### Enterprise-Ready Features

- **Comprehensive Logging**: Structured logging with rotation and archival
- **Error Handling**: Robust error handling with retry mechanisms
- **Health Monitoring**: System health checks and performance metrics
- **Security**: API authentication and rate limiting
- **Scalability**: Cloud-ready architecture with load balancing support

## 🏗️ System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Hardware      │    │   Processing    │    │   Frontend      │
│                 │    │                 │    │                 │
│ • Camera        │───▶│ • FastAPI       │───▶│ • React App     │
│ • Sensors       │    │ • Celery        │    │ • TypeScript    │
│ • Barriers      │    │ • Redis         │    │ • Modern UI     │
│ • Raspberry Pi  │    │ • OpenCV        │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌─────────────────┐              │
         │              │   Storage       │              │
         └──────────────│                 │──────────────┘
                        │ • Google Cloud  │
                        │ • PostgreSQL    │
                        │ • File System   │
                        └─────────────────┘
```

## 🛠️ Installation & Setup

### Prerequisites

**Hardware:**

- Raspberry Pi 4 (4GB+ recommended)
- USB Webcam or Raspberry Pi Camera
- Ultrasonic sensor for vehicle detection
- RFID reader (optional)
- Relay module for barrier control
- MicroSD card (32GB+)

**Software:**

- Node.js 16+ and npm
- Python 3.8+
- Redis server
- FFmpeg
- libcamera tools (for Raspberry Pi)

### Backend Setup

1. **Install Python dependencies:**

```bash
cd backend
pip install -r requirements.txt
```

2. **Start Redis server:**

```bash
redis-server
```

3. **Configure environment variables:**

```bash
cp ../.env.example .env
# Edit .env with your configuration
```

4. **Start the FastAPI server:**

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

5. **Start Celery worker:**

```bash
celery -A tasks worker --loglevel=info
```

### Frontend Setup

1. **Install dependencies:**

```bash
cd frontend
npm install
```

2. **Start the development server:**

```bash
npm start
```

### Hardware Integration Setup

1. **Install Node.js dependencies:**

```bash
npm install
```

2. **Configure camera and sensors:**

```bash
# Test camera
libcamera-hello --timeout 5000

# Configure GPIO pins for sensors and barriers
```

3. **Start the monitoring system:**

```bash
node watchVideo.js
```

## 🚗 Usage

### For Toll Operators

1. **Web Interface**: Access the React frontend at `http://localhost:3000`
2. **Upload Videos**: Drag and drop video files for processing
3. **Monitor Processing**: Real-time status updates and progress tracking
4. **View Results**: Detailed plate detection results with confidence scores
5. **Manage Tasks**: View processing history and manage tasks

### For System Integration

1. **API Endpoints**: RESTful API for integration with existing systems
2. **Webhook Support**: Real-time notifications for toll events
3. **Database Integration**: Direct access to detection and transaction data
4. **Health Monitoring**: Built-in health checks and monitoring endpoints

### For Hardware Deployment

1. **Vehicle Detection**: Ultrasonic sensor triggers video capture
2. **Automatic Processing**: Video is processed automatically
3. **Toll Collection**: Automatic payment processing and barrier control
4. **Fallback Systems**: RFID backup for failed plate recognition

## 📊 API Documentation

### Main Endpoints

- `POST /api/v1/process-video` - Upload and process video
- `GET /api/v1/status/{task_id}` - Get processing status
- `GET /api/v1/results/{task_id}` - Get detailed results
- `GET /api/v1/tasks` - List all processing tasks
- `DELETE /api/v1/tasks/{task_id}` - Delete a task
- `GET /api/v1/health` - System health check

### Example API Usage

```javascript
// Upload video for processing
const formData = new FormData();
formData.append("file", videoFile);

const response = await fetch("/api/v1/process-video", {
  method: "POST",
  body: formData,
});

const result = await response.json();
console.log("Task ID:", result.task_id);

// Check processing status
const statusResponse = await fetch(`/api/v1/status/${result.task_id}`);
const status = await statusResponse.json();
console.log("Status:", status.status);
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file based on `.env.example`:

```env
# Database
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

# APIs
PLATE_RECOGNIZER_TOKEN=your-api-token
ANPR_REGION=us-ca

# Hardware
VIDEO_DURATION=10000
BARRIER_OPEN_COMMAND=gpio write 18 1
BARRIER_CLOSE_COMMAND=gpio write 18 0

# Toll Settings
TOLL_LOCATION=Highway-101-North
```

## 🚀 Deployment

### Production Deployment

1. **Start all services:**

```bash
# Backend
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000
celery -A tasks worker --loglevel=info

# Frontend
cd frontend
npm run build
npm run start

# Hardware monitoring
node watchVideo.js
```

## 🧪 Testing

### Unit Tests

```bash
# Backend tests
cd backend
pytest

# Frontend tests
cd frontend
npm test
```

## 📝 Monitoring & Logging

### Log Files

- Backend: `backend/logs/`
- Processing: `logs/anpr_*.log`
- Hardware: `logs/capture_*.log`

### Monitoring Endpoints

- Health Check: `http://localhost:8000/api/v1/health`
- Status Dashboard: `http://localhost:3000`

## 🛠️ Troubleshooting

### Common Issues

1. **Camera not detected:**

```bash
# Check camera connection
libcamera-hello --list-cameras
```

2. **Plate recognition accuracy low:**

- Improve lighting conditions
- Adjust camera angle and focus
- Update recognition region settings

3. **Processing too slow:**

- Increase Celery worker processes
- Optimize video resolution settings
- Consider GPU acceleration

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🎯 Roadmap

### Version 2.0 (Planned)

- [ ] Machine learning model training interface
- [ ] Advanced analytics dashboard
- [ ] Mobile app for toll operators
- [ ] Multi-language plate recognition
- [ ] Real-time violation detection

---

**Built with ❤️ for modern toll collection systems**
