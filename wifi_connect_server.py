from flask import Flask, request, jsonify
import subprocess
import os
import time
import socket

app = Flask(__name__)

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
    print("DEBUG: Connect endpoint called")
    print(f"DEBUG: Request content type: {request.content_type}")
    print(f"DEBUG: Request is_json: {request.is_json}")
    print(f"DEBUG: Raw request data: {request.get_data()}")
    
    try:
        # Support both JSON and text formats
        if request.is_json:
            data = request.get_json()
            if not data or 'ssid' not in data or 'password' not in data:
                return jsonify({'success': False, 'message': 'Invalid JSON format'}), 400
            ssid = data['ssid'].strip()
            password = data['password'].strip()
        else:
            # Handle old comma-separated format
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
        
        # Use nmcli to connect directly without storing credentials
        try:
            print(f"DEBUG: Attempting to connect to SSID: '{ssid}'")
            print(f"DEBUG: Password length: {len(password)}")
            
            # First, stop any existing hotspot/AP mode
            print("DEBUG: Stopping any existing hotspot...")
            hotspot_result = subprocess.run(['nmcli', 'connection', 'down', 'Hotspot'], 
                         check=False, capture_output=True, text=True)
            print(f"DEBUG: Hotspot stop result: {hotspot_result.returncode}")
            if hotspot_result.stderr:
                print(f"DEBUG: Hotspot stop stderr: {hotspot_result.stderr}")
            
            # Also try stopping any active AP connections
            ap_result = subprocess.run(['nmcli', 'device', 'disconnect', 'wlp0s20f3'], 
                         check=False, capture_output=True, text=True)
            ap_result = subprocess.run(['nmcli', 'device', 'connect', 'wlp0s20f3'], 
                         check=False, capture_output=True, text=True)
            print(f"DEBUG: Device disconnect result: {ap_result.returncode}")
            
            # Wait a moment for the interface to reset
            time.sleep(3)
            
            # Now scan for available networks
            print("DEBUG: Scanning for networks...")
            scan_result = subprocess.run(['nmcli', 'device', 'wifi', 'rescan'], 
                         check=False, capture_output=True, text=True)
            print(f"DEBUG: Scan result code: {scan_result.returncode}")
            if scan_result.stderr:
                print(f"DEBUG: Scan stderr: {scan_result.stderr}")
            
            # Wait a moment for scan to complete
            time.sleep(3)
            
            # Show available networks for debugging
            list_result = subprocess.run(['nmcli', 'device', 'wifi', 'list'], 
                         capture_output=True, text=True)
            print(f"DEBUG: Available networks after hotspot stop:\n{list_result.stdout}")
            
            # Connect to the network (remove sudo - run the whole script with sudo instead)
            print(f"DEBUG: Running connection command...")
            
            # Try regular connection first
            result = subprocess.run([
                'nmcli', 'device', 'wifi', 'connect', 
                ssid, 'password', password
            ], capture_output=True, text=True, timeout=30)
            
            # If failed and SSID not found, try as hidden network
            if result.returncode != 0 and "No network with SSID" in result.stderr:
                print(f"DEBUG: Network not found, trying as hidden network...")
                result = subprocess.run([
                    'nmcli', 'device', 'wifi', 'connect', 
                    ssid, 'password', password, 'hidden', 'yes'
                ], capture_output=True, text=True, timeout=30)
            
            print(f"DEBUG: Connection result code: {result.returncode}")
            print(f"DEBUG: Connection stdout: {result.stdout}")
            print(f"DEBUG: Connection stderr: {result.stderr}")
            
            if result.returncode == 0:
                # After successful connection, wait for it to be established
                print("Connection command succeeded, waiting for network...")
                wait_for_connection()
                
                # Get the new local IP after connection
                local_ip = get_local_ip()
                print(f"New local IP: {local_ip}")
                
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
                    return jsonify({
                        'success': False, 
                        'message': f'Failed to connect: {error_msg}'
                    }), 500
                else:
                    return f"Failed to connect:\n{error_msg}", 500
                
        except subprocess.TimeoutExpired:
            error_msg = 'Connection attempt timed out'
            print(f"DEBUG: {error_msg}")
            if request.is_json:
                return jsonify({
                    'success': False, 
                    'message': error_msg
                }), 500
            else:
                return error_msg, 500
        except subprocess.CalledProcessError as e:
            error_msg = f'Network command failed: {e.stderr}'
            print(f"DEBUG: {error_msg}")
            if request.is_json:
                return jsonify({
                    'success': False, 
                    'message': error_msg
                }), 500
            else:
                return error_msg, 500
            
    except Exception as e:
        error_msg = f'Unexpected error: {str(e)}'
        print(f"DEBUG: {error_msg}")
        import traceback
        print(f"DEBUG: Full traceback:\n{traceback.format_exc()}")
        if request.is_json:
            return jsonify({
                'success': False, 
                'message': error_msg
            }), 500
        else:
            return error_msg, 500

@app.route('/status', methods=['GET'])
def wifi_status():
    try:
        result = subprocess.run([
            'nmcli', 'device', 'wifi', 'list'
        ], capture_output=True, text=True, check=True)
        
        return jsonify({
            'device': "GalBox",
            'success': True,
            'networks': result.stdout
        })
    except subprocess.CalledProcessError as e:
        return jsonify({
            'success': False,
            'message': f'Failed to get WiFi status: {e.stderr}'
        }), 500

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
    
    app.run(host='0.0.0.0', port=5000, debug=False)
