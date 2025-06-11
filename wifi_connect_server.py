from flask import Flask, request, jsonify
from flask_cors import CORS
import subprocess
import json
import re

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

def connect_to_wifi(ssid, password):
    """Connect to WiFi using nmcli"""
    try:
        # First, scan for available networks
        scan_result = subprocess.run(['nmcli', 'device', 'wifi', 'scan'], 
                                   capture_output=True, text=True, timeout=30)
        
        if scan_result.returncode != 0:
            return {"success": False, "error": "Failed to scan for networks"}
        
        # Check if the SSID is available
        list_result = subprocess.run(['nmcli', 'device', 'wifi', 'list'], 
                                   capture_output=True, text=True, timeout=30)
        
        if ssid not in list_result.stdout:
            return {"success": False, "error": f"SSID '{ssid}' not found"}
        
        # Delete existing connection if it exists
        subprocess.run(['nmcli', 'connection', 'delete', ssid], 
                      capture_output=True, timeout=10)
        
        # Create and connect to the WiFi network
        connect_cmd = [
            'nmcli', 'device', 'wifi', 'connect', ssid, 'password', password
        ]
        
        result = subprocess.run(connect_cmd, capture_output=True, text=True, timeout=60)
        
        if result.returncode == 0:
            return {"success": True, "message": f"Successfully connected to {ssid}"}
        else:
            return {"success": False, "error": f"Failed to connect: {result.stderr}"}
            
    except subprocess.TimeoutExpired:
        return {"success": False, "error": "Connection timeout"}
    except Exception as e:
        return {"success": False, "error": f"Unexpected error: {str(e)}"}

def get_current_wifi():
    """Get current WiFi connection info"""
    try:
        result = subprocess.run(['nmcli', '-t', '-f', 'DEVICE,TYPE,STATE,CONNECTION', 'device'], 
                               capture_output=True, text=True, timeout=10)
        
        if result.returncode == 0:
            lines = result.stdout.strip().split('\n')
            for line in lines:
                if 'wifi' in line and 'connected' in line:
                    parts = line.split(':')
                    if len(parts) >= 4:
                        return {"connected": True, "ssid": parts[3]}
        
        return {"connected": False, "ssid": None}
        
    except Exception as e:
        return {"connected": False, "ssid": None, "error": str(e)}

@app.route('/', methods=['GET'])
def home():
    """Home endpoint"""
    current_wifi = get_current_wifi()
    return jsonify({
        "message": "WiFi Connection Server",
        "current_wifi": current_wifi
    })

@app.route('/', methods=['POST'])
def receive_credentials():
    """Receive SSID and password credentials"""
    try:
        # Get the raw data
        data = request.get_data(as_text=True)
        
        # Parse the credentials (format: "SSID,password")
        if ',' in data:
            ssid, password = data.split(',', 1)
            ssid = ssid.strip()
            password = password.strip()
        else:
            return jsonify({"success": False, "error": "Invalid credentials format. Expected: SSID,password"}), 400
        
        if not ssid or not password:
            return jsonify({"success": False, "error": "SSID and password are required"}), 400
        
        print(f"Attempting to connect to WiFi: {ssid}")
        
        # Connect to WiFi
        result = connect_to_wifi(ssid, password)
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({"success": False, "error": f"Server error: {str(e)}"}), 500

@app.route('/status', methods=['GET'])
def wifi_status():
    """Get current WiFi status"""
    current_wifi = get_current_wifi()
    return jsonify(current_wifi)

@app.route('/scan', methods=['GET'])
def scan_networks():
    """Scan for available WiFi networks"""
    try:
        # Scan for networks
        scan_result = subprocess.run(['nmcli', 'device', 'wifi', 'scan'], 
                                   capture_output=True, text=True, timeout=30)
        
        if scan_result.returncode != 0:
            return jsonify({"success": False, "error": "Failed to scan networks"})
        
        # List available networks
        list_result = subprocess.run(['nmcli', '-t', '-f', 'SSID,SIGNAL,SECURITY', 'device', 'wifi', 'list'], 
                                   capture_output=True, text=True, timeout=30)
        
        if list_result.returncode == 0:
            networks = []
            lines = list_result.stdout.strip().split('\n')[1:]  # Skip header
            for line in lines:
                if line.strip():
                    parts = line.split(':')
                    if len(parts) >= 3:
                        ssid = parts[0]
                        if ssid and ssid != '*':  # Filter out empty and current connection
                            networks.append({
                                "ssid": ssid,
                                "signal": parts[1] if len(parts) > 1 else "N/A",
                                "security": parts[2] if len(parts) > 2 else "N/A"
                            })
            
            return jsonify({"success": True, "networks": networks})
        else:
            return jsonify({"success": False, "error": "Failed to list networks"})
            
    except Exception as e:
        return jsonify({"success": False, "error": f"Scan error: {str(e)}"})

if __name__ == '__main__':
    print("Starting WiFi Connection Server...")
    print("Server will be available at: http://0.0.0.0:8484")
    print("Endpoints:")
    print("  GET  /       - Home page with current WiFi status")
    print("  POST /       - Connect to WiFi (send: SSID,password)")
    print("  GET  /status - Get current WiFi status")
    print("  GET  /scan   - Scan for available networks")
    
    app.run(host='0.0.0.0', port=5000, debug=True) 