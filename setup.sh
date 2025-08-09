#!/bin/bash

# ANPR Toll Collection System - Setup Script
# This script sets up the complete system for production deployment

set -e

echo "🚗 ANPR Toll Collection System Setup"
echo "======================================"

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   echo "This script should not be run as root. Please run as a regular user with sudo privileges."
   exit 1
fi

# Update system packages
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install system dependencies
echo "🔧 Installing system dependencies..."
sudo apt install -y \
    python3 \
    python3-pip \
    python3-venv \
    nodejs \
    npm \
    redis-server \
    ffmpeg \
    git \
    curl \
    wget \
    nginx \
    supervisor \
    libcamera-apps \
    python3-opencv \
    libatlas-base-dev \
    libjasper-dev \
    libqtgui4 \
    python3-pyqt5 \
    libqt4-test

# Install Node.js 18 (if not already installed)
if ! command -v node &> /dev/null || [[ $(node -v | cut -d'v' -f2 | cut -d'.' -f1) -lt 16 ]]; then
    echo "📦 Installing Node.js 18..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Create project directories
echo "📁 Creating project directories..."
sudo mkdir -p /opt/anpr-system
sudo chown $USER:$USER /opt/anpr-system
cd /opt/anpr-system

# Copy project files (assuming script is run from project directory)
if [ -d "$(dirname "$0")/../" ]; then
    echo "📋 Copying project files..."
    cp -r "$(dirname "$0")/../"* . 2>/dev/null || :
fi

# Setup Python virtual environment
echo "🐍 Setting up Python environment..."
cd backend
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
deactivate
cd ..

# Setup Node.js dependencies for hardware integration
echo "📦 Installing Node.js dependencies..."
npm install

# Setup frontend
echo "🌐 Setting up frontend..."
cd frontend
npm install
npm run build
cd ..

# Configure Redis
echo "🔴 Configuring Redis..."
sudo systemctl enable redis-server
sudo systemctl start redis-server

# Create configuration files
echo "⚙️ Creating configuration files..."

# Create environment file
if [ ! -f .env ]; then
    cp .env.example .env
    echo "📝 Created .env file. Please edit it with your configuration."
fi

# Create systemd service files
echo "🔧 Creating systemd service files..."

# ANPR Backend Service
sudo tee /etc/systemd/system/anpr-backend.service > /dev/null <<EOF
[Unit]
Description=ANPR Backend API
After=network.target redis.service

[Service]
Type=exec
User=$USER
Group=$USER
WorkingDirectory=/opt/anpr-system/backend
Environment=PATH=/opt/anpr-system/backend/venv/bin
ExecStart=/opt/anpr-system/backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# ANPR Worker Service
sudo tee /etc/systemd/system/anpr-worker.service > /dev/null <<EOF
[Unit]
Description=ANPR Celery Worker
After=network.target redis.service

[Service]
Type=exec
User=$USER
Group=$USER
WorkingDirectory=/opt/anpr-system/backend
Environment=PATH=/opt/anpr-system/backend/venv/bin
ExecStart=/opt/anpr-system/backend/venv/bin/celery -A tasks worker --loglevel=info
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# ANPR Monitor Service
sudo tee /etc/systemd/system/anpr-monitor.service > /dev/null <<EOF
[Unit]
Description=ANPR Hardware Monitor
After=network.target

[Service]
Type=exec
User=$USER
Group=$USER
WorkingDirectory=/opt/anpr-system
ExecStart=/usr/bin/node watchVideo.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Configure Nginx
echo "🌐 Configuring Nginx..."
sudo tee /etc/nginx/sites-available/anpr-system > /dev/null <<EOF
server {
    listen 80;
    server_name localhost;

    # Frontend
    location / {
        root /opt/anpr-system/frontend/build;
        index index.html index.htm;
        try_files \$uri \$uri/ /index.html;
    }

    # API Backend
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        client_max_body_size 100M;
    }

    # Static files
    location /static/ {
        alias /opt/anpr-system/frontend/build/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/anpr-system /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
sudo nginx -t

# Create log directories
echo "📝 Creating log directories..."
mkdir -p logs backend/logs frontend/logs

# Set up log rotation
sudo tee /etc/logrotate.d/anpr-system > /dev/null <<EOF
/opt/anpr-system/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    copytruncate
}

/opt/anpr-system/backend/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    copytruncate
}
EOF

# Configure permissions
echo "🔐 Setting up permissions..."
sudo chown -R $USER:$USER /opt/anpr-system
chmod +x /opt/anpr-system/*.js

# Add user to video group for camera access
sudo usermod -a -G video $USER

# Configure GPIO permissions (for Raspberry Pi)
if [ -f /boot/config.txt ]; then
    echo "🔌 Configuring GPIO permissions..."
    sudo usermod -a -G gpio $USER
    
    # Enable camera
    if ! grep -q "start_x=1" /boot/config.txt; then
        echo "start_x=1" | sudo tee -a /boot/config.txt
        echo "gpu_mem=128" | sudo tee -a /boot/config.txt
    fi
fi

# Enable and start services
echo "🚀 Enabling and starting services..."
sudo systemctl daemon-reload
sudo systemctl enable anpr-backend anpr-worker anpr-monitor
sudo systemctl enable nginx

# Test camera (if available)
echo "📷 Testing camera..."
if command -v libcamera-hello &> /dev/null; then
    timeout 5s libcamera-hello --list-cameras || echo "Camera not detected or not available"
fi

# Create startup script
echo "📝 Creating startup script..."
tee start-anpr-system.sh > /dev/null <<EOF
#!/bin/bash
echo "🚗 Starting ANPR Toll Collection System..."

# Start Redis
sudo systemctl start redis-server

# Start backend services
sudo systemctl start anpr-backend
sudo systemctl start anpr-worker
sudo systemctl start anpr-monitor

# Start Nginx
sudo systemctl start nginx

echo "✅ ANPR System started successfully!"
echo "Frontend: http://localhost"
echo "Backend API: http://localhost/api/v1/"
echo "Health Check: http://localhost/api/v1/health"

# Show service status
sudo systemctl status anpr-backend anpr-worker anpr-monitor nginx --no-pager
EOF

chmod +x start-anpr-system.sh

# Create stop script
tee stop-anpr-system.sh > /dev/null <<EOF
#!/bin/bash
echo "🛑 Stopping ANPR Toll Collection System..."

sudo systemctl stop anpr-backend anpr-worker anpr-monitor nginx

echo "✅ ANPR System stopped!"
EOF

chmod +x stop-anpr-system.sh

# Create status script
tee status-anpr-system.sh > /dev/null <<EOF
#!/bin/bash
echo "📊 ANPR Toll Collection System Status"
echo "======================================"

echo "🔴 Redis:"
sudo systemctl is-active redis-server

echo "🐍 Backend API:"
sudo systemctl is-active anpr-backend

echo "⚙️ Worker:"
sudo systemctl is-active anpr-worker

echo "📡 Monitor:"
sudo systemctl is-active anpr-monitor

echo "🌐 Nginx:"
sudo systemctl is-active nginx

echo ""
echo "📝 Recent Logs:"
echo "Backend API:"
sudo journalctl -u anpr-backend --no-pager -n 5

echo ""
echo "Worker:"
sudo journalctl -u anpr-worker --no-pager -n 5

echo ""
echo "Monitor:"
sudo journalctl -u anpr-monitor --no-pager -n 5
EOF

chmod +x status-anpr-system.sh

# Final setup summary
echo ""
echo "🎉 ANPR Toll Collection System Setup Complete!"
echo "=============================================="
echo ""
echo "📋 Next Steps:"
echo "1. Edit the .env file with your configuration:"
echo "   nano .env"
echo ""
echo "2. Configure your Google Cloud credentials:"
echo "   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/your/service-account.json"
echo ""
echo "3. Add your Plate Recognizer API token to .env"
echo ""
echo "4. Start the system:"
echo "   ./start-anpr-system.sh"
echo ""
echo "5. Access the web interface:"
echo "   http://localhost"
echo ""
echo "📁 Important Files:"
echo "   - Configuration: .env"
echo "   - Start system: ./start-anpr-system.sh"
echo "   - Stop system: ./stop-anpr-system.sh"
echo "   - Check status: ./status-anpr-system.sh"
echo "   - Logs: logs/ and backend/logs/"
echo ""
echo "🔧 System Services:"
echo "   - anpr-backend (FastAPI server)"
echo "   - anpr-worker (Celery worker)"
echo "   - anpr-monitor (Hardware monitoring)"
echo "   - nginx (Web server)"
echo ""

if [ -f /boot/config.txt ]; then
    echo "⚠️  Raspberry Pi detected. Please reboot to enable camera:"
    echo "   sudo reboot"
fi

echo "📚 Documentation: README.md"
echo "🐛 Issues: Check logs or run ./status-anpr-system.sh"
