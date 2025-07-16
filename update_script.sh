#!/bin/bash

# GalOS Update Script
# This script demonstrates how to call the start and percent commands

# Configuration
API_BASE_URL="http://localhost:5421"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to send start command
send_start_command() {
    local command="$1"
    local args="$2"
    
    echo -e "${BLUE}Sending start command: $command $args${NC}"
    
    response=$(curl -s -X POST "$API_BASE_URL/api/command/start" \
        -H "Content-Type: application/json" \
        -d "{\"command\": \"$command\", \"args\": [$args]}")
    
    echo -e "${GREEN}Response: $response${NC}"
    echo ""
}

# Function to send percent command
send_percent_command() {
    local percent="$1"
    
    echo -e "${YELLOW}Sending percent command: $percent%${NC}"
    
    response=$(curl -s -X POST "$API_BASE_URL/api/command/percent" \
        -H "Content-Type: application/json" \
        -d "{\"percent\": $percent}")
    
    echo -e "${GREEN}Response: $response${NC}"
    echo ""
}

# Function to simulate a complete update process
simulate_update() {
    echo -e "${BLUE}=== Starting GalOS Update Process ===${NC}"
    
    # Start the update
    send_start_command "echo" "\"GalOS Update Starting...\""
    
    # Simulate progress updates
    for percent in 10 25 40 60 75 90 100; do
        send_percent_command $percent
        sleep 1  # Wait 1 second between updates
    done
    
    echo -e "${GREEN}=== Update Process Complete ===${NC}"
}

# Function to send a specific command
send_specific_command() {
    local command="$1"
    local args="$2"
    
    case $command in
        "start")
            send_start_command "$args" ""
            ;;
        "percent")
            send_percent_command "$args"
            ;;
        *)
            echo -e "${RED}Unknown command: $command${NC}"
            echo "Usage: $0 {start|percent} [value]"
            ;;
    esac
}

# Main script logic
case "$1" in
    "demo")
        # Run the complete demo
        simulate_update
        ;;
    "start")
        # Send a start command
        if [ -z "$2" ]; then
            send_start_command "echo" "\"GalOS Starting...\""
        else
            send_start_command "$2" "$3"
        fi
        ;;
    "percent")
        # Send a percent command
        if [ -z "$2" ]; then
            echo -e "${RED}Please provide a percentage value${NC}"
            echo "Usage: $0 percent [0-100]"
        else
            send_percent_command "$2"
        fi
        ;;
    "docker")
        # Example: Start Docker container
        send_start_command "docker" "\"start\", \"my-container\""
        ;;
    "system")
        # Example: System update
        send_start_command "apt" "\"update\""
        send_percent_command 25
        send_start_command "apt" "\"upgrade\", \"-y\""
        send_percent_command 75
        send_percent_command 100
        ;;
    *)
        echo -e "${BLUE}GalOS Update Script${NC}"
        echo ""
        echo "Usage:"
        echo "  $0 demo                    - Run complete update simulation"
        echo "  $0 start [command] [args]  - Send start command"
        echo "  $0 percent [0-100]         - Send percent command"
        echo "  $0 docker                  - Example: Start Docker container"
        echo "  $0 system                  - Example: System update"
        echo ""
        echo "Examples:"
        echo "  $0 start echo \"Hello World\""
        echo "  $0 percent 85"
        echo "  $0 demo"
        ;;
esac 