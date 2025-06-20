const express = require('express');
const { exec } = require('child_process');
const cors = require('cors');
const WebSocket = require('ws');

const app = express();
const port = 5421;

// Create WebSocket server
const wss = new WebSocket.Server({ port: 3002 });

app.use(cors());
app.use(express.json());

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('Client connected');

  // Send initial data
  sendSystemInfo(ws);

  // Set up interval to send updates
  const interval = setInterval(() => {
    sendSystemInfo(ws);
  }, 1000);

  ws.on('close', () => {
    console.log('Client disconnected');
    clearInterval(interval);
  });
});

// Function to get system information
function sendSystemInfo(ws) {
  // Get WiFi information using nmcli (for Ubuntu)
  exec('nmcli -t -f active,ssid dev wifi | egrep "^yes" | cut -d: -f2', (error, stdout, stderr) => {
    if (error) {
      console.error(`Error: ${error}`);
      return;
    }

    const ssid = stdout.trim() || 'Not Connected';

    // Get CPU usage
    exec('top -l 1 | grep "CPU usage"', (error, stdout, stderr) => {
      if (error) {
        console.error(`Error: ${error}`);
        return;
      }

      const data = {
        wifi: ssid,
        cpu: stdout.trim(),
        timestamp: new Date().toISOString()
      };

      // Send data to connected client
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
      }
    });
  });
}

// WiFi endpoint using nmcli for Ubuntu
app.get('/api/wifi', (req, res) => {
  exec('nmcli -t -f active,ssid dev wifi | egrep "^yes" | cut -d: -f2', (error, stdout, stderr) => {
    if (error) {
      console.error(`Error: ${error}`);
      return res.status(500).json({ error: 'Failed to get WiFi info' });
    }

    const ssid = stdout.trim() || 'Not Connected';
    res.json({ ssid });
  });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
}); 