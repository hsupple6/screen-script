#!/bin/bash
exec > >(tee -a logfile.log) 2>&1

# Fix X11 display permissions
export DISPLAY=:0
xhost +local:root 2>/dev/null || true

# Configure display orientations (portrait left)
echo "Configuring display orientations..."

# Get list of connected displays
DISPLAYS=$(xrandr --query | grep " connected" | cut -d" " -f1)

# Set each display to portrait left (270 degrees rotation)
for display in $DISPLAYS; do
  echo "Setting $display to portrait left orientation..."
  xrandr --output $display --rotate left 2>/dev/null || {
    echo "Warning: Failed to rotate $display"
  }
done

# Verify display orientations
echo "Current display orientations:"
xrandr --query | grep -E "(connected|primary)" | head -10

# Create proper cache directory instead of /dev/null
CACHE_DIR="/tmp/chromium-cache-$$"
mkdir -p "$CACHE_DIR"

# Start frontend (React app)
echo "Starting frontend..."
(
  cd ~/screen-script || exit 1
  npm start >> ~/frontend.log 2>&1 &
  FRONTEND_PID=$!
  echo $FRONTEND_PID > /tmp/frontend.pid
)

# Wait for frontend port 1600 to be open
echo "Waiting for frontend to start..."
timeout=30
for i in $(seq 1 $timeout); do
  if nc -z localhost 1600; then
    echo "Frontend started on port 1600"
    break
  else
    echo "Waiting for frontend on port 1600... ($i/$timeout)"
    sleep 1
  fi
done

if ! nc -z localhost 1600; then
  echo "Frontend failed to start in time"
  exit 1
fi

# Start Chromium with proper cache directory and error handling
echo "Starting Chromium in kiosk mode..."
chromium-browser --app=http://localhost:1600 \
  --start-fullscreen \
  --kiosk \
  --window-size=1080,1920 \
  --window-position=2160,0 \
  --noerrdialogs \
  --disable-infobars \
  --incognito \
  --disable-translate \
  --no-first-run \
  --fast \
  --disable-gpu \
  --no-sandbox \
  --disable-dev-shm-usage \
  --disable-background-timer-throttling \
  --disable-backgrounding-occluded-windows \
  --disable-renderer-backgrounding \
  --user-data-dir="$CACHE_DIR/user-data" \
  --disk-cache-dir="$CACHE_DIR/cache" \
  --disable-features=TranslateUI \
  --disable-ipc-flooding-protection \
  >> ~/chromium.log 2>&1 &

CHROMIUM_PID=$!
echo $CHROMIUM_PID > /tmp/chromium.pid

# Wait for Chromium window to appear with better detection
echo "Waiting for Chromium window..."
timeout=30
window_found=false
for i in $(seq 1 $timeout); do
  # Check multiple possible window titles
  if wmctrl -l | grep -E "(React App|localhost:1600|Chromium)" > /dev/null; then
    echo "Chromium window detected"
    window_found=true
    break
  else
    echo "Waiting for Chromium window... ($i/$timeout)"
    sleep 1
  fi
done

# Position window only once after it's found
if [ "$window_found" = true ]; then
  sleep 2  # Give window time to fully load
  echo "Positioning Chromium window..."
  
  # Try different window title patterns
  for title_pattern in "React App" "localhost:1600" "Chromium"; do
    if wmctrl -l | grep "$title_pattern" > /dev/null; then
      wmctrl -r "$title_pattern" -e 0,2160,0,1920,1080
      echo "Window positioned using title: $title_pattern"
      break
    fi
  done
else
  echo "Warning: Chromium window not detected, but continuing..."
fi

# Start Pictures slideshow in second Chromium instance
echo "Starting Pictures slideshow..."
chromium-browser --app=http://localhost:1600/pictures \
  --start-fullscreen \
  --kiosk \
  --window-size=2160,3840 \
  --window-position=0,0 \
  --noerrdialogs \
  --disable-infobars \
  --incognito \
  --disable-translate \
  --no-first-run \
  --fast \
  --disable-gpu \
  --no-sandbox \
  --disable-dev-shm-usage \
  --disable-background-timer-throttling \
  --disable-backgrounding-occluded-windows \
  --disable-renderer-backgrounding \
  --user-data-dir="$CACHE_DIR/pictures-user-data" \
  --disk-cache-dir="$CACHE_DIR/pictures-cache" \
  --disable-features=TranslateUI \
  --disable-ipc-flooding-protection \
  >> ~/pictures-chromium.log 2>&1 &

PICTURES_PID=$!
echo $PICTURES_PID > /tmp/pictures.pid

# Wait for Pictures window to appear
echo "Waiting for Pictures window..."
timeout=30
pictures_window_found=false
for i in $(seq 1 $timeout); do
  # Look for the second Chromium window
  CHROMIUM_WINDOWS=$(wmctrl -l | grep -E "(React App|localhost:1600|Chromium)" | wc -l)
  if [ "$CHROMIUM_WINDOWS" -ge 2 ]; then
    echo "Pictures window detected"
    pictures_window_found=true
    break
  else
    echo "Waiting for Pictures window... ($i/$timeout)"
    sleep 1
  fi
done

# Position Pictures window
if [ "$pictures_window_found" = true ]; then
  sleep 2  # Give window time to fully load
  echo "Positioning Pictures window..."
  
  # Get all Chromium windows and position the last one (newest)
  WINDOW_IDS=$(wmctrl -l | grep -E "(React App|localhost:1600|Chromium)" | tail -1 | awk '{print $1}')
  if [ -n "$WINDOW_IDS" ]; then
    wmctrl -i -r "$WINDOW_IDS" -e 0,0,0,2160,3840
    echo "Pictures window positioned at (0,0) with size 2160x3840"
  fi
else
  echo "Warning: Pictures window not detected, but continuing..."
fi

# Now start backend (separate this from frontend/chromium startup)
echo "Starting backend..."
(
  cd ~/screen-script/backend || exit 1
  npm start >> ~/backend.log 2>&1 &
  BACKEND_PID=$!
  echo $BACKEND_PID > /tmp/backend.pid
)

FRONTEND_PID=$(cat /tmp/frontend.pid 2>/dev/null || echo "unknown")
BACKEND_PID=$(cat /tmp/backend.pid 2>/dev/null || echo "unknown")

echo "Services started:"
echo "Frontend PID: $FRONTEND_PID"
echo "Chromium PID: $CHROMIUM_PID" 
echo "Backend PID: $BACKEND_PID"

# --- Kill any lingering containers or ports ---
echo "Cleaning up existing processes..."

# Enhanced port killing function
kill_port() {
  local port=$1
  echo "Checking port $port..."
  
  # Method 1: lsof
  pid=$(lsof -ti tcp:"$port" 2>/dev/null)
  if [ -n "$pid" ]; then
    echo "Port $port is in use by PID $pid. Killing it..."
    kill -9 "$pid"
    sleep 1
  fi
  
  # Method 2: fuser (more aggressive)
  sudo fuser -k "$port"/tcp 2>/dev/null || true

  # Method 3: netstat check and kill
  netstat_pids=$(netstat -tlnp 2>/dev/null | grep ":$port " | awk '{print $7}' | cut -d'/' -f1 | grep -v '-')
  for npid in $netstat_pids; do
    if [ -n "$npid" ] && [ "$npid" != "-" ]; then
      echo "Found additional PID $npid on port $port. Killing it..."
      kill -9 "$npid" 2>/dev/null || true
    fi
  done
  
  # Verify port is free
  if lsof -ti tcp:"$port" >/dev/null 2>&1; then
    echo "Port $port still in use after cleanup attempts"
    return 1
  else
    echo "Port $port is now free"
    return 0
  fi
}

# Kill all potentially conflicting ports
for p in 5001 9000 9001 9200 27017 3000 1234; do
  kill_port "$p"
done

# Kill any node/python processes that might be holding ports
echo "Killing any lingering Node.js and Python processes..."
pkill -f "npm start" || true
pkill -f "node.*start" || true
pkill -f "python.*start" || true
pkill -f "flask" || true
pkill -f "bash.*start.sh" || true

# Fix the directory path
cd /home/galbox/Desktop || cd ~/Desktop || cd ~

# --- Disable screen blanking ---
echo "Configuring display settings..."
xset s off
xset -dpms
xset s noblank

# --- Start Docker daemon with proper error handling ---
echo "Checking Docker services..."

# Stop Docker cleanly first to reset any issues
sudo systemctl stop docker.socket 2>/dev/null || true
sudo systemctl stop docker 2>/dev/null || true
sudo pkill -f docker 2>/dev/null || true
sudo pkill -f containerd 2>/dev/null || true
sudo rm -f /var/run/docker.sock 2>/dev/null || true
sudo rm -f /var/run/docker.pid 2>/dev/null || true

# Wait a moment for cleanup
sleep 3

# Reset systemd failure state
sudo systemctl reset-failed docker.service 2>/dev/null || true
sudo systemctl reset-failed docker.socket 2>/dev/null || true

# Start Docker daemon
echo "Starting Docker daemon..."
sudo systemctl start docker.socket
sudo systemctl start docker

# Wait for Docker to fully start
sleep 5

# Check Docker accessibility
if docker info >/dev/null 2>&1; then
    echo "Docker is accessible"
    DOCKER_CMD="docker"
elif sudo docker info >/dev/null 2>&1; then
    echo "Docker requires sudo access"
    echo "Adding user to docker group..."
    sudo usermod -aG docker $USER
    echo "Note: You may need to log out and back in for group changes to take effect"
    echo "Using sudo for Docker commands in this session..."
    DOCKER_CMD="sudo docker"
else
    echo "Docker is not accessible even with sudo"
    echo "Docker service status:"
    sudo systemctl status docker --no-pager -l
    echo "Attempting to fix Docker..."
    
    # Try to fix common Docker issues
    sudo systemctl daemon-reload
    sudo systemctl enable docker
    sudo systemctl start docker
    sleep 10
    
    if sudo docker info >/dev/null 2>&1; then
        echo "Docker fixed and accessible with sudo"
        DOCKER_CMD="sudo docker"
    else
        echo "Docker still not working, continuing without Docker services..."
        exit 1
    fi
fi

echo "Using Docker command: $DOCKER_CMD"

cd ~/galOS || { echo "Cannot find galOS directory"; exit 1; }

# Clean up existing Docker containers and networks
echo "Cleaning up existing Docker containers..."
$DOCKER_CMD compose --profile dev down --remove-orphans 2>/dev/null || true
$DOCKER_CMD container prune -f 2>/dev/null || true
$DOCKER_CMD network prune -f 2>/dev/null || true

# Remove specific containers that might conflict
echo "Removing conflicting containers..."
for container in mongodb minio elasticsearch galos-mongodb galos-minio galos-elasticsearch; do
    if $DOCKER_CMD ps -a --format "{{.Names}}" | grep -q "${container}"; then
        echo "Removing existing container: $container"
        $DOCKER_CMD rm -f "$container" 2>/dev/null || true
    fi
done

# Start Docker Compose services
echo "Starting Docker Compose services..."
$DOCKER_CMD compose --profile dev up -d
if [ $? -ne 0 ]; then
    echo "Docker Compose failed to start"
    echo "Checking for any remaining conflicting containers..."
    $DOCKER_CMD ps -a
    exit 1
fi

# Wait for Docker services to be ready with health checks
echo "Waiting for Docker services to initialize..."

# Function to wait for a service to be ready
wait_for_service() {
    local service=$1
    local port=$2
    local max_attempts=30
    local attempt=1
    
    echo "Waiting for $service on port $port..."
    
    while [ $attempt -le $max_attempts ]; do
        if nc -z localhost $port 2>/dev/null; then
            echo "$service is ready on port $port"
            return 0
        fi
        
        echo "Attempt $attempt/$max_attempts - $service not ready yet..."
        sleep 2
        ((attempt++))
    done
    
    echo "$service failed to start within timeout"
    return 1
}

# Wait for each service individually
wait_for_service "MongoDB" 27017 || { echo "MongoDB startup failed"; exit 1; }
wait_for_service "Elasticsearch" 9200 || { echo "Elasticsearch startup failed"; exit 1; }
wait_for_service "MinIO" 9000 || { echo "MinIO startup failed"; exit 1; }

# Verify port 5001 is still free before starting backend
if ! kill_port 5001; then
    echo "Port 5001 could not be freed for backend"
    exit 1
fi

# Updating Backend
echo "Ensuring backend is up to date"
(
  git fetch

  LOCAL=$(git rev-parse @)
  REMOTE=$(git rev-parse @{u})
  BASE=$(git merge-base @ @{u})

  if [ "$LOCAL" = "$REMOTE" ]; then
    echo "Backend already up to date."
  elif [ "$LOCAL" = "$BASE" ]; then
    curl -s -X POST "localhost:5421/api/command/start" \
    -H "Content-Type: application/json" \
    -d '{"command": "echo"}'

    echo "Backend behind remote. Pulling updates..."
    git pull
    curl -s -X POST "localhost:5421/api/command/percent" \
    -H "Content-Type: application/json" \
    -d '{"percent": 15}'

    cd backend/scripts || exit 1
    ./install.sh
    curl -s -X POST "localhost:5421/api/command/percent" \
    -H "Content-Type: application/json" \
    -d '{"percent": 75}'

    cd ~/galOS/websocket-server || exit 1
    npm install
    curl -s -X POST "localhost:5421/api/command/percent" \
    -H "Content-Type: application/json" \
    -d '{"percent": 85}'

    cd ~/galOS/galbox-server/api || exit 1
    npm install
    curl -s -X POST "localhost:5421/api/command/percent" \
    -H "Content-Type: application/json" \
    -d '{"percent": 90}'

    cd ~/screen-script || exit 1
    git pull
    (cd backend && npm i) &
    (npm i) &
    curl -s -X POST "localhost:5421/api/command/percent" \
    -H "Content-Type: application/json" \
    -d '{"percent": 100}'

    cd ~/galOS
  else
    echo "Local backend repo has diverged. Please resolve manually."
    exit 1
  fi
)

# Updating Screen Script
echo "Ensuring screen-script is up to date"
(
  cd ~/screen-script
  git fetch

  LOCAL=$(git rev-parse @)
  REMOTE=$(git rev-parse @{u})
  BASE=$(git merge-base @ @{u})

  if [ "$LOCAL" = "$REMOTE" ]; then
    echo "Screen Script already up to date."
  elif [ "$LOCAL" = "$BASE" ]; then
    curl -s -X POST "localhost:5421/api/command/start" \
    -H "Content-Type: application/json" \
    -d '{"command": "echo"}'

    echo "Screen Script behind remote. Pulling updates..."
    git pull
    curl -s -X POST "localhost:5421/api/command/percent" \
    -H "Content-Type: application/json" \
    -d '{"percent": 35}'

    cd ~/screen-script
    npm install
    
    cd ~/screen-script/backend
    npm install
    curl -s -X POST "localhost:5421/api/command/percent" \
    -H "Content-Type: application/json" \
    -d '{"percent": 100}'
  else
    echo "Local Screen Script repo has diverged. Please resolve manually."
    exit 1
  fi
)

# Start backend service
echo "Starting backend service..."
(
  sleep 10
  cd backend || exit 1
  if [ -f venv/bin/activate ]; then
    source venv/bin/activate
  else
    echo "Virtual environment not found in backend/"
    exit 1
  fi
  
  if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
  fi
  
  # Set environment variables for better error handling
  export FLASK_ENV=development
  export PYTHONUNBUFFERED=1
  
  if [ -f scripts/start.sh ]; then
    bash scripts/start.sh --flask
  else
    echo "Backend start script not found"
    exit 1
  fi
) &
BACKEND_PID=$!

# Check if backend is running on port 5001
sleep 15
if ! nc -z localhost 5001; then
    echo "Backend failed to start on port 5001"
    echo "Checking backend process..."
    if ! kill -0 $BACKEND_PID 2>/dev/null; then
        echo "Backend process died"
    fi
fi

# Start Ollama
ollama serve &

# Start Galbox Server
echo "Starting Galbox server..."
(
  cd galbox-server/api || exit 1
  node server.js
) &

# Start WebSocket server
echo "Starting WebSocket server..."
(
  cd websocket-server || exit 1
  if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
  fi
  
  if [ -f package.json ]; then
    npm start
  else
    echo "WebSocket server package.json not found"
    exit 1
  fi
) &
WEBSOCKET_PID=$!

# Wait a bit before starting GUI
sleep 5

# Start GUI
(  
  cd gui || exit 1
  if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
  fi
  
  if [ -f package.json ]; then
    npm start
  else
    echo "GUI package.json not found"
    exit 1
  fi
) &
GUI_PID=$!

echo "All services started!"
echo "Backend PID: $BACKEND_PID"
echo "WebSocket PID: $WEBSOCKET_PID" 
echo "GUI PID: $GUI_PID"

# Monitor services
echo "Monitoring services..."
sleep 5

# Check if all services are still running
for pid in $BACKEND_PID $WEBSOCKET_PID $GUI_PID; do
    if ! kill -0 $pid 2>/dev/null; then
        echo "Service process has died (PID: $pid)"
    fi
done

# Final status check
echo "Final service status:"
echo "Port 5001 (Backend): $(nc -z localhost 5001 && echo "Open" || echo "Closed")"
echo "Port 9200 (Elasticsearch): $(nc -z localhost 9200 && echo "Open" || echo "Closed")"
echo "Port 27017 (MongoDB): $(nc -z localhost 27017 && echo "Open" || echo "Closed")"
echo "Port 9000 (MinIO): $(nc -z localhost 9000 && echo "Open" || echo "Closed")"

# Wait for all background processes
wait
