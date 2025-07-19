#!/bin/bash
exec > >(tee -a logfile.log) 2>&1

# Fix X11 display permissions
export DISPLAY=:0
xhost +local:root 2>/dev/null || true

# Create proper cache directory instead of /dev/null
CACHE_DIR="/tmp/chromium-cache-$$"
mkdir -p "$CACHE_DIR"

# Function to cleanup on exit
cleanup() {
    echo "Cleaning up..."
    [[ -n "$FRONTEND_PID" ]] && kill $FRONTEND_PID 2>/dev/null
    [[ -n "$CHROMIUM_PID" ]] && kill $CHROMIUM_PID 2>/dev/null
    rm -rf "$CACHE_DIR"
}
trap cleanup EXIT

# Start frontend (React app)
echo "Starting frontend..."
(
  cd ~/screen-script || exit 1
  npm start >> ~/frontend.log 2>&1 &
  FRONTEND_PID=$!
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

# Now start backend (separate this from frontend/chromium startup)
echo "Starting backend..."
(
  cd ~/screen-script/backend || exit 1
  npm start >> ~/backend.log 2>&1 &
  BACKEND_PID=$!
)

echo "Services started:"
echo "Frontend PID: $FRONTEND_PID"
echo "Chromium PID: $CHROMIUM_PID" 
echo "Backend PID: $BACKEND_PID"

# Wait for backend with better error handling
echo "Waiting for backend to start..."
timeout=60  # Increased timeout for backend
backend_started=false
for i in $(seq 1 $timeout); do
  if nc -z localhost 5001; then
    echo "Backend started on port 5001"
    backend_started=true
    break
  else
    echo "Waiting for backend on port 5001... ($i/$timeout)"
    sleep 1
    
    # Check if backend process is still running
    if ! kill -0 $BACKEND_PID 2>/dev/null; then
      echo "Backend process died. Check ~/backend.log for errors."
      exit 1
    fi
  fi
done

if [ "$backend_started" != true ]; then
  echo "Backend failed to start in time, but keeping frontend running"
  echo "Check ~/backend.log for backend errors"
  # Don't exit - keep frontend running
fi

# Keep script running and monitor processes
echo "Monitoring services..."
while true; do
  sleep 10
  
  # Check if critical processes are still running
  if ! kill -0 $FRONTEND_PID 2>/dev/null; then
    echo "Frontend process died, restarting..."
    exit 1
  fi
  
  if ! kill -0 $CHROMIUM_PID 2>/dev/null; then
    echo "Chromium process died, restarting..."
    exit 1
  fi
  
  # Optional: restart backend if it dies but keep frontend running
  if [ "$backend_started" = true ] && ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "Backend process died, attempting restart..."
    (
      cd ~/screen-script/backend || exit 1
      npm start >> ~/backend.log 2>&1 &
      BACKEND_PID=$!
    )
  fi
done

# --- Kill any lingering containers or ports ---
echo " Cleaning up existing processes..."

# Stop Docker and socket cleanly first
sudo systemctl stop docker.socket
sudo systemctl stop docker
sudo pkill -f docker
sudo pkill -f containerd
sudo rm -f /var/run/docker.sock
sudo rm -f /var/run/docker.pid

# Enhanced port killing function
kill_port() {
  local port=$1
  echo " Checking port $port..."
  
  # Method 1: lsof
  pid=$(lsof -ti tcp:"$port" 2>/dev/null)
  if [ -n "$pid" ]; then
    echo "ort $port is in use by PID $pid. Killing it..."
    kill -9 "$pid"
    sleep 1
  fi
  
  # Method 2: fuser (more aggressive)
  
  sudo fuser -k "$port"/tcp 2>/dev/null

  # Method 3: netstat check and kill
  
netstat_pids=$(netstat -tlnp 2>/dev/null | grep ":$port " | awk '{print $7}' | cut -d'/' -f1 | grep -v '-')
  for npid in $netstat_pids; do
    if [ -n "$npid" ] && [ "$npid" != "-" ]; then
      echo "Found additional PID $npid on port $port. Killing it..."
      kill -9 "$npid" 2>/dev/null
    fi
  done
 # Verify port is free
  
  if lsof -ti tcp:"$port" >/dev/null 2>&1; then
    echo " Port $port still in use after cleanup attempts"
    return 1
  else
    echo " Port $port is now free"
    return 0
  fi
}

# Kill all potentially conflicting ports
(for p in 5001 9000 9001 9200 27017 3000 1234; do
  kill_port "$p"
done
) &
# Kill any node/python processes that might be holding ports
(echo " Killing any lingering Node.js and Python processes..."
pkill -f "npm start" || true
pkill -f "node.*start" || true
pkill -f "python.*start" || true
pkill -f "flask" || true
pkill -f "bash.*start.sh" || true
) &

cd /home/kiosk/Desktop

# --- Disable screen blanking ---
echo "onfiguring display settings..."
xset s off
xset -dpms
xset s noblank

# --- Start services sequentially with proper error handling ---
echo " Checking Docker services..."

# Check if Docker daemon is running
if sudo systemctl is-active docker >/dev/null 2>&1; then
    echo " Docker daemon is running"
else
    echo " Starting Docker daemon..."
    sudo systemctl start docker.socket
    sudo systemctl start docker
    sleep 5
fi

# Check Docker accessibility (permission issue)
if docker info >/dev/null 2>&1; then
    echo " Docker is accessible"
elif sudo docker info >/dev/null 2>&1; then
    echo "ocker requires sudo access"
    echo " Adding user to docker group..."
    sudo usermod -aG docker $USER
    echo " Note: You may need to log out and back in for group changes to take effect"
    echo " Using sudo for Docker commands in this session..."
    DOCKER_CMD="sudo docker"
else
    echo " Docker is not accessible even with sudo"
    echo " Docker service status:"
    sudo systemctl status docker --no-pager -l
    exit 1
fi

# Set Docker command (with or without sudo)
if docker info >/dev/null 2>&1; then
    DOCKER_CMD="docker"
else
    DOCKER_CMD="sudo docker"
fi

echo " Using Docker command: $DOCKER_CMD"

cd galOS || { echo " Cannot find galOS directory"; exit 1; }

# Clean up existing Docker containers and networks
echo " Cleaning up existing Docker containers..."
$DOCKER_CMD compose --profile dev down --remove-orphans 2>/dev/null || true
$DOCKER_CMD container prune -f 2>/dev/null || true
$DOCKER_CMD network prune -f 2>/dev/null || true
# Remove specific containers that might conflict
echo "emoving conflicting containers..."
for container in mongodb minio elasticsearch galos-mongodb galos-minio galos-elasticsearch; do
    if $DOCKER_CMD ps -a --format "{{.Names}}" | grep -q "${container}"; then
        echo "Removing existing container: $container"
        $DOCKER_CMD rm -f "$container" 2>/dev/null || true
    fi
done

# Start Docker Compose services
(echo " Starting Docker Compose services..."
$DOCKER_CMD compose --profile dev up -d
if [ $? -ne 0 ]; then
    echo " Docker Compose failed to start"
    echo " Checking for any remaining conflicting containers..."
    $DOCKER_CMD ps -a
    exit 1
fi

# Wait for Docker services to be ready with health checks
echo " Waiting for Docker services to initialize..."

# Function to wait for a service to be ready
wait_for_service() {
    local service=$1
    local port=$2
    local max_attempts=30
    local attempt=1
    
    echo " Waiting for $service on port $port..."
    
    while [ $attempt -le $max_attempts ]; do
        if nc -z localhost $port 2>/dev/null; then
            echo " $service is ready on port $port"
            return 0
        fi
        
        echo " Attempt $attempt/$max_attempts - $service not ready yet..."
        sleep 2
        ((attempt++))
    done
    
    echo " $service failed to start within timeout"
    return 1
}

# Wait for each service individually
wait_for_service "MongoDB" 27017 || { echo " MongoDB startup failed"; exit 1; }
wait_for_service "Elasticsearch" 9200 || { echo " Elasticsearch startup failed"; exit 1; }
wait_for_service "MinIO" 9000 || { echo " MinIO startup failed"; exit 1; }

# Additional Elasticsearch health check
#echo " Checking Elasticsearch health..."
#for i in {1..15}; do
#    if curl -s http://localhost:9200/_cluster/health >/dev/null 2>&1; then
#        echo " Elasticsearch is healthy"
#        break
#    fi
#    echo " Waiting for Elasticsearch health... ($i/15)"
#    sleep 2
#done



# Verify port 5001 is still free before starting backend
if ! kill_port 5001; then
    echo " Port 5001 could not be freed for backend"
    exit 1
fi

(


#Updating Backend
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
    (cd backend
    npm i) &
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

#Updating Screen Script
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
echo " Starting backend service..."
(
  sleep 10
  cd backend || exit 1
  if [ -f venv/bin/activate ]; then
    source venv/bin/activate
  else
    echo " Virtual environment not found in backend/"
    exit 1
  fi
  
  if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
  fi
  
  # Set environment variables for better error handling
  export FLASK_ENV=development
  export PYTHONUNBUFFERED=1
  
  if [ -f scripts/start.sh ]; then
    bash scripts/start.sh
  else
    echo " Backend start script not found"
    exit 1
  fi
) &
BACKEND_PID=$!

# Check if backend is running on port 5001
if ! nc -z localhost 5001; then
    echo " Backend failed to start on port 5001"
    echo " Checking backend process..."
    if ! kill -0 $BACKEND_PID 2>/dev/null; then
        echo " Backend process died"
        exit 1
    fi
fi
) &

ollama serve &

# Start Galbox Server
echo "Starting Galbox server..."
(
  cd galbox-server/api || exit 1
  node server.js
) &

# Start WebSocket server
echo " Starting WebSocket server..."
(
  cd websocket-server || exit 1
  if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
  fi
  
  if [ -f package.json ]; then
    npm start
  else
    echo " WebSocket server package.json not found"
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
    echo " GUI package.json not found"
    exit 1
  fi
) &
GUI_PID=$!

echo " All services started!"
echo "Backend PID: $BACKEND_PID"
echo "WebSocket PID: $WEBSOCKET_PID" 
echo "GUI PID: $GUI_PID"

# Monitor services
echo " Monitoring services..."
sleep 5

# Check if all services are still running
for pid in $BACKEND_PID $WEBSOCKET_PID $GUI_PID; do
    if ! kill -0 $pid 2>/dev/null; then
        echo " service process has died (PID: $pid)"
    fi
done

# Final status check
echo " Final service status:"
echo "Port 5001 (Backend): $(nc -z localhost 5001 && echo " Open" || echo  "Closed")"
echo "Port 9200 (Elasticsearch): $(nc -z localhost 9200 && echo " Open" || echo  "Closed")"
echo "Port 27017 (MongoDB): $(nc -z localhost 27017 && echo " Open" || echo " Closed")"
echo "Port 9000 (MinIO): $(nc -z localhost 9000 && echo " Open" || echo"  Closed")"

# Wait for all background processes
wait
