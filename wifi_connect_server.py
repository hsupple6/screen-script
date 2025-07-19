#!/usr/bin/env python3
from flask import Flask
import socket
import time

app = Flask(__name__)

@app.route('/')
def ping():
    return "galbox"

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

if __name__ == '__main__':
    # Wait for network connection
    wait_for_connection()
    
    # Get local IP
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.connect(("8.8.8.8", 80))
    ip = s.getsockname()[0]
    s.close()
    
    print(f"Discovery service running at: {ip}:5000")
    app.run(host='0.0.0.0', port=5000)
