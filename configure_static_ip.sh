#!/bin/bash

# Static IP configuration script for WiFi interface
# This script configures a static IP for the WiFi interface to prevent IP changes

INTERFACE="wlp0s20f3"
STATIC_IP="192.168.1.100"
GATEWAY="192.168.1.1"
DNS="8.8.8.8"
SUBNET="255.255.255.0"

echo "Configuring static IP for WiFi interface..."

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "This script must be run as root (use sudo)"
    exit 1
fi

# Check if interface exists
if ! ip link show $INTERFACE > /dev/null 2>&1; then
    echo "Interface $INTERFACE not found"
    exit 1
fi

# Get the current connection name
CONNECTION_NAME=$(nmcli -t -f NAME,TYPE,DEVICE connection show --active | grep $INTERFACE | cut -d: -f1)

if [ -z "$CONNECTION_NAME" ]; then
    echo "No active connection found for interface $INTERFACE"
    echo "Creating new connection with static IP..."
    
    # Create a new connection with static IP
    nmcli connection add type wifi con-name "static_wifi" ifname $INTERFACE \
        ipv4.addresses $STATIC_IP/24 \
        ipv4.gateway $GATEWAY \
        ipv4.dns $DNS \
        ipv4.method manual \
        wifi.ssid "temp_ssid" \
        wifi.password "temp_password"
    
    if [ $? -eq 0 ]; then
        echo "Static IP connection created successfully"
        echo "Note: You'll need to configure the actual WiFi SSID and password"
    else
        echo "Failed to create static IP connection"
        exit 1
    fi
else
    echo "Found active connection: $CONNECTION_NAME"
    echo "Configuring static IP for existing connection..."
    
    # Configure static IP for existing connection
    nmcli connection modify "$CONNECTION_NAME" \
        ipv4.addresses $STATIC_IP/24 \
        ipv4.gateway $GATEWAY \
        ipv4.dns $DNS \
        ipv4.method manual
    
    if [ $? -eq 0 ]; then
        echo "Static IP configured successfully for $CONNECTION_NAME"
        echo "Restarting connection to apply changes..."
        
        # Restart the connection to apply changes
        nmcli connection down "$CONNECTION_NAME"
        sleep 2
        nmcli connection up "$CONNECTION_NAME"
        
        if [ $? -eq 0 ]; then
            echo "Connection restarted successfully with static IP"
        else
            echo "Warning: Failed to restart connection, but static IP is configured"
        fi
    else
        echo "Failed to configure static IP"
        exit 1
    fi
fi

echo "Static IP configuration complete: $STATIC_IP"
echo "Gateway: $GATEWAY"
echo "DNS: $DNS" 