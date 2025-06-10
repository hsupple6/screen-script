const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

// Get current WiFi information using airport utility
app.get('/api/wifi', async (req, res) => {
    try {
        console.log('Fetching WiFi information...');
        const { stdout } = await execPromise('/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport -I');
        console.log('Airport output:', stdout);
        
        const ssidMatch = stdout.match(/[^B]SSID: (.+)/);
        const signalMatch = stdout.match(/agrCtlRSSI: (.+)/);
        
        console.log('SSID match:', ssidMatch);
        console.log('Signal match:', signalMatch);
        
        if (ssidMatch) {
            const response = {
                ssid: ssidMatch[1].trim(),
                signal_level: signalMatch ? parseInt(signalMatch[1]) : null
            };
            console.log('Sending response:', response);
            res.json(response);
        } else {
            console.log('No SSID found in output');
            res.json({ error: 'No WiFi connection found' });
        }
    } catch (error) {
        console.error('Error executing airport command:', error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
}); 