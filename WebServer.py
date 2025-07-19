#!/usr/bin/env python3
from flask import Flask, request, jsonify
from flask_cors import CORS
import subprocess
import os
import time
import socket
import threading
import signal
import sys

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Global variables for monitoring
monitoring_active = True
current_ssid = None
current_password = None
hotspot_ssid = "galbox_wifi"
hotspot_password = "12345678"
interface = "wlp0s20f3"
last_connection_attempt = 0
connection_cooldown = 30  # 30 seconds cooldown after connection attempts

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
        # First try to get IP from the WiFi interface directly
        result = subprocess.run([
            'ip', 'addr', 'show', interface
        ], capture_output=True, text=True, check=True)
        
        # Parse the output to find the IP address
        lines = result.stdout.split('\n')
        for line in lines:
            if 'inet ' in line and not line.strip().startswith('#'):
                # Extract IP address (remove /24 subnet mask)
                ip = line.strip().split()[1].split('/')[0]
                if ip and ip != '127.0.0.1':
                    return ip
        
        # Fallback: try to connect to a remote address
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(3)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        return local_ip
    except Exception as e:
        print(f"Error getting local IP: {e}")
        # Last resort: try to get any IP from the system
        try:
            result = subprocess.run([
                'hostname', '-I'
            ], capture_output=True, text=True, check=True)
            ips = result.stdout.strip().split()
            for ip in ips:
                if ip and ip != '127.0.0.1' and not ip.startswith('169.254'):
                    return ip
        except:
            pass
        return "Unknown"

def get_current_wifi_ssid():
    """Get the current WiFi SSID"""
    try:
        result = subprocess.run([
            'nmcli', '-t', '-f', 'active,ssid', 'device', 'wifi'
        ], capture_output=True, text=True, check=True)
        
        lines = result.stdout.strip().split('\n')
        for line in lines:
            if line.startswith('yes:'):
                return line.split(':', 1)[1]
        return None
    except:
        return None

def start_hotspot():
    """Start the WiFi hotspot"""
    try:
        print(f"Starting hotspot: {hotspot_ssid}")
        subprocess.run([
            "nmcli", "device", "wifi", "hotspot", 
            "ifname", interface, 
            "ssid", hotspot_ssid, 
            "password", hotspot_password
        ], check=True, capture_output=True)
        print(f"Hotspot {hotspot_ssid} started successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"Failed to start hotspot: {e}")
        return False

def stop_hotspot():
    """Stop the WiFi hotspot"""
    try:
        subprocess.run([
            "nmcli", "device", "disconnect", interface
        ], check=True, capture_output=True)
        print("Hotspot stopped")
        return True
    except subprocess.CalledProcessError as e:
        print(f"Failed to stop hotspot: {e}")
        return False

def attempt_reconnect():
    """Attempt to reconnect to the last known WiFi network"""
    global current_ssid, current_password
    
    if not current_ssid or not current_password:
        print("No saved WiFi credentials to reconnect to")
        return False
    
    try:
        print(f"Attempting to reconnect to {current_ssid}...")
        result = subprocess.run([
            'nmcli', 'device', 'wifi', 'connect',
            current_ssid, 'password', current_password
        ], capture_output=True, text=True, timeout=30)
        
        if result.returncode == 0:
            print(f"Successfully reconnected to {current_ssid}")
            return True
        else:
            print(f"Failed to reconnect to {current_ssid}: {result.stderr}")
            return False
    except subprocess.TimeoutExpired:
        print("Reconnection attempt timed out")
        return False
    except Exception as e:
        print(f"Reconnection error: {e}")
        return False

def monitor_wifi_connection():
    """Monitor WiFi connection and revert to hotspot if lost"""
    global monitoring_active, current_ssid, last_connection_attempt, connection_cooldown
    
    print("Starting WiFi connection monitoring...")
    
    while monitoring_active:
        try:
            current_ssid = get_current_wifi_ssid()
            current_time = time.time()
            
            # Check if we're in cooldown period
            if current_time - last_connection_attempt < connection_cooldown:
                remaining_cooldown = connection_cooldown - (current_time - last_connection_attempt)
                print(f"In cooldown period, remaining: {remaining_cooldown:.1f} seconds")
                time.sleep(10)
                continue
            
            # Check if we're connected to a network (not hotspot)
            if current_ssid and current_ssid != hotspot_ssid:
                print(f"Connected to: {current_ssid}")
                
                # Check if we can reach the internet
                if not is_connected():
                    print("Internet connection lost, attempting to reconnect...")
                    print("Reconnection failed, starting hotspot...")
                    stop_hotspot()
                    time.sleep(2)
                    start_hotspot()
            else:
                # Not connected to any network or connected to hotspot
                if current_ssid != hotspot_ssid:
                    print("No WiFi connection detected, starting hotspot...")
                    start_hotspot()
            
            # Wait before next check
            time.sleep(10)  # Check every 10 seconds
            
        except Exception as e:
            print(f"Error in WiFi monitoring: {e}")
            time.sleep(10)

def signal_handler(signum, frame):
    """Handle shutdown signals"""
    global monitoring_active
    print("\nShutting down WiFi server...")
    monitoring_active = False
    sys.exit(0)

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
        global current_ssid, current_password
        
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

        # Stop hotspot if it's running
        if get_current_wifi_ssid() == hotspot_ssid:
            stop_hotspot()
            time.sleep(2)

        # Begin connection attempt
        subprocess.run(['nmcli', 'device', 'wifi', 'rescan'], check=False, capture_output=True)
        time.sleep(2)

        result = subprocess.run([
            'nmcli', 'device', 'wifi', 'connect',
            ssid, 'password', password
        ], capture_output=True, text=True, timeout=30)

        if result.returncode == 0:
            wait_for_connection()
            local_ip = get_local_ip()
            
            # Save credentials for reconnection
            current_ssid = ssid
            current_password = password
            
            # Set cooldown to prevent immediate reversion
            global last_connection_attempt
            last_connection_attempt = time.time()
            print(f"Connection successful, cooldown active for {connection_cooldown} seconds")

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
        global current_ssid, current_password
        
        data = request.get_json()
        ssid = data.get('ssid')
        password = data.get('password')

        if not ssid or not password:
            return jsonify({'status': 'error', 'message': 'Missing ssid or password'}), 400

        # Stop hotspot if it's running
        if get_current_wifi_ssid() == hotspot_ssid:
            stop_hotspot()
            time.sleep(2)

        # Command to connect using nmcli
        cmd = ['nmcli', 'device', 'wifi', 'connect', ssid, 'password', password]

        result = subprocess.run(cmd, capture_output=True, text=True)

        if result.returncode == 0:
            # Save credentials for reconnection
            current_ssid = ssid
            current_password = password
            
            # Set cooldown to prevent immediate reversion
            global last_connection_attempt
            last_connection_attempt = time.time()
            print(f"WiFi change successful, cooldown active for {connection_cooldown} seconds")
            
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
    current_ssid = get_current_wifi_ssid()
    is_hotspot = current_ssid == hotspot_ssid
    
    return jsonify({
        'hostname': hostname,
        'ip': local_ip,
        'current_ssid': current_ssid,
        'is_hotspot': is_hotspot,
        'interface': interface,
        'message': f'This is {hostname} at {local_ip}'
    })

@app.route('/debug/ip', methods=['GET'])
def debug_ip():
    """Debug endpoint to show IP detection details"""
    try:
        # Get IP using different methods
        ip_method1 = None
        ip_method2 = None
        ip_method3 = None
        
        # Method 1: ip addr show
        try:
            result = subprocess.run([
                'ip', 'addr', 'show', interface
            ], capture_output=True, text=True, check=True)
            lines = result.stdout.split('\n')
            for line in lines:
                if 'inet ' in line and not line.strip().startswith('#'):
                    ip = line.strip().split()[1].split('/')[0]
                    if ip and ip != '127.0.0.1':
                        ip_method1 = ip
                        break
        except Exception as e:
            ip_method1 = f"Error: {e}"
        
        # Method 2: hostname -I
        try:
            result = subprocess.run([
                'hostname', '-I'
            ], capture_output=True, text=True, check=True)
            ip_method2 = result.stdout.strip()
        except Exception as e:
            ip_method2 = f"Error: {e}"
        
        # Method 3: socket connection
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.settimeout(3)
            s.connect(("8.8.8.8", 80))
            ip_method3 = s.getsockname()[0]
            s.close()
        except Exception as e:
            ip_method3 = f"Error: {e}"
        
        return jsonify({
            'final_ip': get_local_ip(),
            'method1_ip_addr': ip_method1,
            'method2_hostname_I': ip_method2,
            'method3_socket': ip_method3,
            'interface': interface,
            'current_ssid': get_current_wifi_ssid()
        })
    except Exception as e:
        return jsonify({
            'error': str(e)
        }), 500

# Add the galbox endpoint for discovery
@app.route('/galbox', methods=['GET'])
def galbox():
    return "galbox"

if __name__ == '__main__':
    # Check if running with appropriate permissions
    if os.geteuid() != 0:
        print("ERROR: This script MUST be run with sudo privileges!")
        print("Run with: sudo python3 WebServer.py")
        exit(1)
    
    # Set up signal handlers for graceful shutdown
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # 25-second startup delay
    print("WebServer.py starting up...")
    print("Waiting 25 seconds for system initialization...")
    for i in range(60, 0, -1):
        print(f"Starting in {i} seconds...", end='\r')
        time.sleep(1)
    print("\nSystem initialization complete!")
    
    # Start WiFi monitoring in a separate thread
    monitor_thread = threading.Thread(target=monitor_wifi_connection, daemon=True)
    monitor_thread.start()
    
    # Start the server
    print("WiFi server starting with root privileges...")
    print("WiFi monitoring active - will revert to hotspot if connection lost")
    print("Send POST request to connect to WiFi")
    
    app.run(host='0.0.0.0', port=5420, debug=False)
