#!/usr/bin/env python3
from flask import Flask, request, jsonify
from flask_cors import CORS
import subprocess
import os
import time
import socket

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

def is_connected():
    """Check if connected to network"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(3)
        s.connect(("8.8.8.8", 80))
        s.close()
        return True
    except:
        return False

def wait_for_connection():
    """Wait until connected to network"""
    print("Waiting for network connection...")
    while not is_connected():
        print("No connection, waiting...")
        time.sleep(2)
    print("Connected!")

def get_local_ip():
    try:
        # Connect to a remote address to determine local IP
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        return local_ip
    except:
        return "Unknown"

@app.route('/', methods=['POST'])
@app.route('/connect', methods=['POST'])
def connect_wifi():
    if is_connected():
        local_ip = get_local_ip()
        if request.is_json:
            return jsonify({
                'success': True,
                'message': 'Already connected to a network',
                'local_ip': local_ip
            })
        else:
            return f"Already connected to a network. Local IP: {local_ip}"

    # ↓↓↓ Only run this block if NOT already connected ↓↓↓
    try:
        interface = "wlp0s20f3"
        ssid  = "galbox_wifi"
        password = "12345678"

        response = subprocess.run(["nmcli", "device", "wifi", "hotspot", "ifname", interface, "ssid", ssid, "password", password], check = True, capture_output = True, text = True)
        print(response.stdout)

        if request.is_json:
            data = request.get_json()
            if not data or 'ssid' not in data or 'password' not in data:
                return jsonify({'success': False, 'message': 'Invalid JSON format'}), 400
            ssid = data['ssid'].strip()
            password = data['password'].strip()
        else:
            text_data = request.get_data(as_text=True).strip()
            try:
                ssid, password = text_data.split(',', 1)
                ssid = ssid.strip()
                password = password.strip()
            except ValueError:
                return "Invalid format. Expected SSID,password", 400

        if not ssid:
            if request.is_json:
                return jsonify({'success': False, 'message': 'SSID cannot be empty'}), 400
            else:
                return "SSID cannot be empty", 400

        # Begin connection attempt only if not already connected
        subprocess.run(['nmcli', 'device', 'wifi', 'rescan'], check=False, capture_output=True)
        time.sleep(2)

        result = subprocess.run([
            'nmcli', 'device', 'wifi', 'connect',
            ssid, 'password', password
        ], capture_output=True, text=True, timeout=30)

        if result.returncode == 0:
            wait_for_connection()
            local_ip = get_local_ip()

            if request.is_json:
                return jsonify({
                    'success': True,
                    'message': f'Successfully connected to {ssid}',
                    'local_ip': local_ip
                })
            else:
                return f"Connected to {ssid}!\nLocal IP: {local_ip}\n{result.stdout}"
        else:
            error_msg = result.stderr.strip() or result.stdout.strip()
            if request.is_json:
                return jsonify({'success': False, 'message': f'Failed to connect: {error_msg}'}), 500
            else:
                return f"Failed to connect:\n{error_msg}", 500

    except subprocess.TimeoutExpired:
        if request.is_json:
            return jsonify({'success': False, 'message': 'Connection attempt timed out'}), 500
        else:
            return "Connection attempt timed out", 500

    except Exception as e:
        if request.is_json:
            return jsonify({'success': False, 'message': f'Unexpected error: {str(e)}'}), 500
        else:
            return f"Unexpected error: {str(e)}", 500
@app.route('/status', methods=['GET'])
def wifi_status():
    try:
        result = subprocess.run([
            'nmcli', 'device', 'wifi', 'list'
        ], capture_output=True, text=True, check=True)
        
        return jsonify({
            'device': "GalBox",
            'galID': "Andromeda1hls",
            'success': True,
        })
    except subprocess.CalledProcessError as e:
        return jsonify({
            'success': False,
            'message': f'Failed to get WiFi status: {e.stderr}'
        }), 500
        
@app.route('/changewifi', methods=['POST'])
def change_wifi():
    try:
        data = request.get_json()
        ssid = data.get('ssid')
        password = data.get('password')

        if not ssid or not password:
            return jsonify({'status': 'error', 'message': 'Missing ssid or password'}), 400

        # Command to connect using nmcli
        cmd = ['nmcli', 'device', 'wifi', 'connect', ssid, 'password', password]

        result = subprocess.run(cmd, capture_output=True, text=True)

        if result.returncode == 0:
            return jsonify({'status': 'success', 'message': result.stdout.strip()}), 200
        else:
            return jsonify({
                'status': 'error',
                'message': result.stderr.strip(),
                'output': result.stdout.strip()
            }), 500

    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500
        
@app.route('/identify', methods=['GET'])
def identify():
    hostname = os.uname().nodename
    local_ip = get_local_ip()
    return jsonify({
        'hostname': hostname,
        'ip': local_ip,
        'message': f'This is {hostname} at {local_ip}'
    })

# Add the galbox endpoint for discovery
@app.route('/galbox', methods=['GET'])
def galbox():
    return "galbox"

if __name__ == '__main__':
    # Check if running with appropriate permissions
    if os.geteuid() != 0:
        print("ERROR: This script MUST be run with sudo privileges!")
        print("Run with: sudo python3 wifi_server.py")
        exit(1)
    
    # Start the server immediately - connection happens when requested
    print("WiFi server starting with root privileges...")
    print("Send POST request to connect to WiFi")
    
    app.run(host='0.0.0.0', port=5420, debug=False)
