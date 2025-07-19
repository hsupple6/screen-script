#!/bin/bash

# GalOS Download Script
# This script demonstrates how to call the model and percent commands for downloading

# Configuration
API_BASE_URL="http://localhost:5421"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Function to send model command
send_model_command() {
    local model="$1"
    local size="$2"
    local args="$3"
    
    echo -e "${PURPLE}Sending model command: $model $size $args${NC}"
    
    response=$(curl -s -X POST "$API_BASE_URL/api/command/model" \
        -H "Content-Type: application/json" \
        -d "{\"model\": \"$model\", \"size\": \"$size\", \"args\": [$args]}")
    
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

# Function to simulate a complete download process
simulate_download() {
    local model="$1"
    local size="$2"
    
    echo -e "${BLUE}=== Starting ${model} ${size} Download Process ===${NC}"
    
    # Start the download
    send_model_command "$model" "$size" ""
    
    # Simulate progress updates (slower than update)
    for percent in 5 15 30 45 60 75 85 95 100; do
        send_percent_command $percent
        sleep 2  # Wait 2 seconds between updates (slower than update)
    done
    
    echo -e "${GREEN}=== Download Process Complete ===${NC}"
}

# Function to send a specific command
send_specific_command() {
    local command="$1"
    local model="$2"
    local size="$3"
    
    case $command in
        "model")
            send_model_command "$model" "$size" ""
            ;;
        "percent")
            send_percent_command "$size"
            ;;
        *)
            echo -e "${RED}Unknown command: $command${NC}"
            echo "Usage: $0 {model|percent} [model] [size/percent]"
            ;;
    esac
}

# Main script logic
if [ $# -eq 0 ]; then
    # No arguments provided, run demo
    echo -e "${BLUE}=== GalOS Download Demo ===${NC}"
    echo ""
    
    # Demo different model downloads
    simulate_download "llama2" "7b"
    sleep 3
    simulate_download "mistral" "7b"
    sleep 3
    simulate_download "codellama" "13b"
    
elif [ $# -eq 3 ]; then
    # Three arguments: command, model, size/percent
    send_specific_command "$1" "$2" "$3"
else
    echo -e "${RED}Invalid number of arguments${NC}"
    echo ""
    echo "Usage:"
    echo "  $0                    # Run demo downloads"
    echo "  $0 model llama2 7b    # Send model command"
    echo "  $0 percent 50         # Send percent command"
    echo ""
    echo "Examples:"
    echo "  $0 model llama2 7b"
    echo "  $0 model mistral 7b"
    echo "  $0 model codellama 13b"
    echo "  $0 percent 75"
fi 