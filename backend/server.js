const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const util = require('util');
const os = require('os');
const fs = require('fs');
const path = require('path');
const execPromise = util.promisify(exec);

const app = express();
const port = 5421;

// Configure CORS to allow requests from React app
app.use(cors({
  origin: [
    'http://localhost:1600',
    'http://127.0.0.1:1600',
    'http://192.168.1.65:1600',
    'http://192.168.1.64:1600'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, '../public')));

// Get current IP address
app.get('/api/system/ip', async (req, res) => {
    try {
        console.log('Fetching IP address...');
        
        // Get local IP address (Ubuntu)
        try {
            const { stdout } = await execPromise("ip route get 1.1.1.1 | awk '{for(i=1;i<=NF;i++) if($i==\"src\") print $(i+1); exit}'");
            const localIP = stdout.trim();
            
            if (localIP) {
                res.json({
                    local_ip: localIP,
                    type: 'local'
                });
            } else {
                res.json({ error: 'Could not determine IP address' });
            }
        } catch (error) {
            console.error('Error getting IP address:', error);
            res.json({ error: 'IP detection failed' });
        }
    } catch (error) {
        console.error('Error in IP endpoint:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get current WiFi information for Ubuntu
app.get('/api/wifi', async (req, res) => {
    try {
        console.log('Fetching WiFi information...');
        
        // Use nmcli (NetworkManager) to get active WiFi connection
        try {
            const { stdout } = await execPromise('nmcli -t -f active,ssid dev wifi | grep "^yes"');
            console.log('nmcli output:', stdout);
            
            if (stdout.trim()) {
                const ssid = stdout.split(':')[1];
                
                // Get signal strength
                let signalLevel = null;
                try {
                    const { stdout: signalOutput } = await execPromise(`nmcli -t -f signal dev wifi | head -1`);
                    signalLevel = parseInt(signalOutput.trim()) || null;
                } catch (signalError) {
                    console.log('Could not get signal strength:', signalError.message);
                }
                
                const response = {
                    ssid: ssid.trim(),
                    signal_level: signalLevel
                };
                console.log('Sending WiFi response:', response);
                res.json(response);
            } else {
                res.json({ error: 'No active WiFi connection found' });
            }
        } catch (nmcliError) {
            console.error('nmcli command failed:', nmcliError);
            
            // Fallback: try iwgetid command
            try {
                const { stdout: iwOutput } = await execPromise('iwgetid -r');
                if (iwOutput.trim()) {
                    const response = {
                        ssid: iwOutput.trim(),
                        signal_level: null
                    };
                    console.log('Sending WiFi fallback response:', response);
                    res.json(response);
                } else {
                    res.json({ error: 'No WiFi connection found' });
                }
            } catch (iwError) {
                console.error('Both nmcli and iwgetid failed:', iwError);
                res.json({ error: 'WiFi detection failed' });
            }
        }
    } catch (error) {
        console.error('Error getting WiFi information:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get system RAM usage
app.get('/api/system/ram', async (req, res) => {
    try {
        const platform = os.platform();
        
        if (platform === 'darwin') {
            // macOS - use vm_stat command
            const { stdout } = await execPromise('vm_stat');
            
            // Parse vm_stat output
            const lines = stdout.split('\n');
            let pageSize = 4096; // Default page size
            let freePages = 0;
            let activePages = 0;
            let inactivePages = 0;
            let speculativePages = 0;
            let throttledPages = 0;
            let wiredPages = 0;
            let compressedPages = 0;
            
            lines.forEach(line => {
                if (line.includes('page size of')) {
                    pageSize = parseInt(line.match(/(\d+)/)[1]);
                } else if (line.includes('Pages free:')) {
                    freePages = parseInt(line.match(/(\d+)/)[1]);
                } else if (line.includes('Pages active:')) {
                    activePages = parseInt(line.match(/(\d+)/)[1]);
                } else if (line.includes('Pages inactive:')) {
                    inactivePages = parseInt(line.match(/(\d+)/)[1]);
                } else if (line.includes('Pages speculative:')) {
                    speculativePages = parseInt(line.match(/(\d+)/)[1]);
                } else if (line.includes('Pages throttled:')) {
                    throttledPages = parseInt(line.match(/(\d+)/)[1]);
                } else if (line.includes('Pages wired down:')) {
                    wiredPages = parseInt(line.match(/(\d+)/)[1]);
                } else if (line.includes('Pages stored in compressor:')) {
                    compressedPages = parseInt(line.match(/(\d+)/)[1]);
                }
            });
            
            // Calculate memory usage like Activity Monitor
            const totalPages = freePages + activePages + inactivePages + speculativePages + throttledPages + wiredPages + compressedPages;
            const usedPages = activePages + wiredPages + compressedPages;
            const totalMem = totalPages * pageSize;
            const usedMem = usedPages * pageSize;
            const usagePercent = Math.round((usedMem / totalMem) * 100);
            
            console.log(`RAM Usage (macOS vm_stat): ${usagePercent}% (${Math.round(usedMem / 1024 / 1024 / 1024)}GB used of ${Math.round(totalMem / 1024 / 1024 / 1024)}GB)`);
            
            res.json({
                usage: usagePercent,
                used: Math.round(usedMem / 1024 / 1024 / 1024 * 100) / 100, // GB with 2 decimal places
                total: Math.round(totalMem / 1024 / 1024 / 1024), // GB
                free: Math.round((freePages + speculativePages) * pageSize / 1024 / 1024 / 1024 * 100) / 100, // GB
                method: 'vm_stat',
                platform: 'macOS',
                unit: 'GB'
            });
            
        } else if (platform === 'linux') {
            // Ubuntu/Linux - use /proc/meminfo
            const { stdout } = await execPromise('cat /proc/meminfo');
            
            const lines = stdout.split('\n');
            let memTotal = 0;
            let memFree = 0;
            let memAvailable = 0;
            let buffers = 0;
            let cached = 0;
            let sReclaimable = 0;
            
            lines.forEach(line => {
                if (line.startsWith('MemTotal:')) {
                    memTotal = parseInt(line.match(/(\d+)/)[1]) * 1024; // Convert kB to bytes
                } else if (line.startsWith('MemFree:')) {
                    memFree = parseInt(line.match(/(\d+)/)[1]) * 1024;
                } else if (line.startsWith('MemAvailable:')) {
                    memAvailable = parseInt(line.match(/(\d+)/)[1]) * 1024;
                } else if (line.startsWith('Buffers:')) {
                    buffers = parseInt(line.match(/(\d+)/)[1]) * 1024;
                } else if (line.startsWith('Cached:')) {
                    cached = parseInt(line.match(/(\d+)/)[1]) * 1024;
                } else if (line.startsWith('SReclaimable:')) {
                    sReclaimable = parseInt(line.match(/(\d+)/)[1]) * 1024;
                }
            });
            
            // Calculate used memory (similar to htop/free command)
            const usedMem = memTotal - (memAvailable || (memFree + buffers + cached + sReclaimable));
            const usagePercent = Math.round((usedMem / memTotal) * 100);
            
            console.log(`RAM Usage (Linux /proc/meminfo): ${usagePercent}% (${Math.round(usedMem / 1024 / 1024 / 1024)}GB used of ${Math.round(memTotal / 1024 / 1024 / 1024)}GB)`);
            
            res.json({
                usage: usagePercent,
                used: Math.round(usedMem / 1024 / 1024 / 1024 * 100) / 100, // GB
                total: Math.round(memTotal / 1024 / 1024 / 1024), // GB
                available: Math.round((memAvailable || memFree) / 1024 / 1024 / 1024 * 100) / 100, // GB
                method: 'proc_meminfo',
                platform: 'Linux',
                unit: 'GB'
            });
            
        } else {
            // Windows or other platforms - fallback to Node.js method
            throw new Error(`Unsupported platform: ${platform}`);
        }
        
    } catch (error) {
        console.error('Error getting RAM usage with platform-specific method:', error);
        
        // Fallback to Node.js method for any platform
        try {
            const totalMem = os.totalmem();
            const freeMem = os.freemem();
            const usedMem = totalMem - freeMem;
            const usagePercent = Math.round((usedMem / totalMem) * 100);
            
            console.log(`RAM Usage (fallback Node.js): ${usagePercent}% (${Math.round(usedMem / 1024 / 1024 / 1024)}GB used of ${Math.round(totalMem / 1024 / 1024 / 1024)}GB)`);
            
            res.json({
                usage: usagePercent,
                used: Math.round(usedMem / 1024 / 1024 / 1024 * 100) / 100, // GB
                total: Math.round(totalMem / 1024 / 1024 / 1024), // GB
                free: Math.round(freeMem / 1024 / 1024 / 1024 * 100) / 100, // GB
                method: 'os_module_fallback',
                platform: os.platform(),
                unit: 'GB'
            });
        } catch (fallbackError) {
            console.error('Error with fallback RAM method:', fallbackError);
            res.status(500).json({ error: fallbackError.message });
        }
    }
});

// Get system disk storage usage
app.get('/api/system/storage', async (req, res) => {
    try {
        // On macOS, specifically target the Data volume which contains user data
        // On Linux, fall back to root filesystem
        let stdout;
        let mountPoint = '/';
        
        try {
            // Try to get macOS Data volume first
            const result = await execPromise('df -h /System/Volumes/Data');
            stdout = result.stdout;
            mountPoint = '/System/Volumes/Data';
        } catch (macError) {
            // Fallback to general df command for Linux/other systems
            const result = await execPromise('df -h /');
            stdout = result.stdout;
            mountPoint = '/';
        }
        
        const lines = stdout.split('\n');
        
        // Parse the second line (first line is headers)
        if (lines.length < 2) {
            throw new Error('Invalid df output');
        }
        
        const diskLine = lines[1].trim();
        const parts = diskLine.split(/\s+/);
        
        // Expected format: Filesystem Size Used Avail Capacity iused ifree %iused Mounted
        if (parts.length < 4) {
            throw new Error('Invalid df output format');
        }
        
        // Parse the usage percentage (remove the % sign)
        const usagePercent = parseInt(parts[4].replace('%', ''));
        const totalStr = parts[1];
        const usedStr = parts[2];
        const availableStr = parts[3];
        
        // Convert storage strings to GB numbers for accurate calculation
        const parseStorage = (str) => {
            const num = parseFloat(str);
            if (str.includes('Ti') || str.includes('T')) return num * 1024;
            if (str.includes('Gi') || str.includes('G')) return num;
            if (str.includes('Mi') || str.includes('M')) return num / 1024;
            if (str.includes('Ki') || str.includes('K')) return num / (1024 * 1024);
            return num;
        };
        
        const totalGB = parseStorage(totalStr);
        const usedGB = parseStorage(usedStr);
        const availableGB = parseStorage(availableStr);
        
        console.log(`Disk Usage: ${usagePercent}% (${usedGB.toFixed(1)}GB used of ${totalGB.toFixed(1)}GB) - ${mountPoint}`);
        
        res.json({
            usage: usagePercent,
            used: Math.round(usedGB * 10) / 10, // Round to 1 decimal place
            total: Math.round(totalGB * 10) / 10,
            available: Math.round(availableGB * 10) / 10,
            mountPoint: mountPoint,
            unit: 'GB'
        });
    } catch (error) {
        console.error('Error getting storage usage:', error);
        
        // Fallback: try to get disk usage on Windows
        try {
            const { stdout } = await execPromise('wmic logicaldisk get size,freespace,caption');
            // Parse Windows disk info if needed
            res.json({ usage: 50, error: 'Windows disk parsing not implemented' });
        } catch (winError) {
            res.status(500).json({ error: 'Could not get disk usage on this system' });
        }
    }
});

// Get system CPU usage
app.get('/api/system/cpu', async (req, res) => {
    try {
        // Get CPU load average (1 minute)
        const loadAvg = os.loadavg()[0];
        const cpuCount = os.cpus().length;
        const cpuUsagePercent = Math.round((loadAvg / cpuCount) * 100);
        
        console.log(`CPU Usage: ${cpuUsagePercent}% (Load: ${loadAvg.toFixed(2)}, Cores: ${cpuCount})`);
        
        res.json({
            usage: Math.min(cpuUsagePercent, 100), // Cap at 100%
            loadAverage: loadAvg,
            cores: cpuCount,
            model: os.cpus()[0].model
        });
    } catch (error) {
        console.error('Error getting CPU usage:', error);
        res.status(500).json({ error: error.message });
    }
});



// Get Docker status with detailed telemetrics
app.get('/api/system/docker', async (req, res) => {
    try {
        // Check if Docker daemon is actually running by trying to list containers
        const { stdout: containerCount } = await execPromise('docker ps -q | wc -l');
        const { stdout: imageCount } = await execPromise('docker images -q | wc -l');
        
        // If we get here, Docker is definitely running
        const runningContainers = parseInt(containerCount.trim()) || 0;
        const totalImages = parseInt(imageCount.trim()) || 0;
        
        // Get detailed container information with telemetrics
        let containerDetails = [];
        let totalCpuUsage = 0;
        let totalMemoryUsage = 0;
        let totalNetworkRx = 0;
        let totalNetworkTx = 0;
        let elasticsearchHealth = null;
        
        if (runningContainers > 0) {
            try {
                // Get container stats (CPU, Memory, Network)
                const { stdout: statsOutput } = await execPromise('docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.Name}}"');
                const statsLines = statsOutput.split('\n').slice(1); // Skip header
                
                for (const line of statsLines) {
                    if (line.trim()) {
                        const parts = line.trim().split('\t');
                        if (parts.length >= 5) {
                            const containerName = parts[4];
                            const cpuPercent = parseFloat(parts[1].replace('%', '')) || 0;
                            const memUsage = parts[2];
                            const netIO = parts[3];
                            
                            // Parse network I/O (format: "1.2kB / 3.4kB")
                            const netParts = netIO.split(' / ');
                            const netRx = parseNetworkBytes(netParts[0] || '0B');
                            const netTx = parseNetworkBytes(netParts[1] || '0B');
                            
                            containerDetails.push({
                                name: containerName,
                                cpu: cpuPercent,
                                memory: memUsage,
                                networkRx: netRx,
                                networkTx: netTx
                            });
                            
                            totalCpuUsage += cpuPercent;
                            totalNetworkRx += netRx;
                            totalNetworkTx += netTx;
                            
                            // Check if this is an Elasticsearch container
                            if (containerName.toLowerCase().includes('elasticsearch') || containerName.toLowerCase().includes('elastic')) {
                                try {
                                    // Try to get Elasticsearch health status
                                    const { stdout: esHealth } = await execPromise(`docker exec ${containerName} curl -s http://localhost:9200/_cluster/health`);
                                    elasticsearchHealth = JSON.parse(esHealth);
                                } catch (esError) {
                                    console.log(`Could not get Elasticsearch health from ${containerName}:`, esError.message);
                                }
                            }
                        }
                    }
                }
            } catch (statsError) {
                console.log('Could not get container stats:', statsError.message);
            }
        }
        
        // Calculate usage based on containers and activity
        const baseUsage = Math.min(totalImages * 8, 80); // Base usage from images
        const activityUsage = Math.min(totalCpuUsage, 20); // Activity bonus
        const usage = Math.min(baseUsage + activityUsage, 100);
        
        console.log(`Docker Status: ${runningContainers} containers, ${totalImages} images, ${usage}% usage, CPU: ${totalCpuUsage.toFixed(1)}%`);
        
        // Get Docker version info
        let version = 'unknown';
        try {
            const { stdout: dockerInfo } = await execPromise('docker info --format "{{.ServerVersion}}"');
            version = dockerInfo.trim();
        } catch (versionError) {
            console.log('Could not get Docker version:', versionError.message);
        }
        
        res.json({
            status: 'running',
            usage: usage,
            containers: runningContainers,
            images: totalImages,
            version: version,
            telemetrics: {
                containerDetails: containerDetails,
                totalCpuUsage: Math.round(totalCpuUsage * 10) / 10,
                totalNetworkRx: totalNetworkRx,
                totalNetworkTx: totalNetworkTx,
                elasticsearch: elasticsearchHealth
            },
            message: `Docker running with ${totalImages} images, ${runningContainers} active containers`
        });
        
    } catch (error) {
        // Docker is not running or not installed
        console.log('Docker not available:', error.message);
        res.json({
            status: 'stopped',
            usage: 0,
            containers: 0,
            images: 0,
            telemetrics: null,
            message: 'Docker is not running or not installed'
        });
    }
});

// Get detailed Elasticsearch telemetrics
app.get('/api/system/elasticsearch', async (req, res) => {
    try {
        // Find Elasticsearch containers
        const { stdout: containerList } = await execPromise('docker ps --format "{{.Names}}" | grep -i elastic');
        const esContainers = containerList.trim().split('\n').filter(name => name.trim());
        
        if (esContainers.length === 0) {
            return res.json({
                status: 'not_found',
                message: 'No Elasticsearch containers found'
            });
        }
        
        const elasticsearchData = [];
        
        for (const containerName of esContainers) {
            try {
                // Get cluster health
                const { stdout: healthData } = await execPromise(`docker exec ${containerName} curl -s http://localhost:9200/_cluster/health`);
                const health = JSON.parse(healthData);
                
                // Get cluster stats
                const { stdout: statsData } = await execPromise(`docker exec ${containerName} curl -s http://localhost:9200/_cluster/stats`);
                const stats = JSON.parse(statsData);
                
                // Get node info
                const { stdout: nodesData } = await execPromise(`docker exec ${containerName} curl -s http://localhost:9200/_nodes/stats`);
                const nodes = JSON.parse(nodesData);
                
                elasticsearchData.push({
                    container: containerName,
                    health: {
                        status: health.status,
                        cluster_name: health.cluster_name,
                        number_of_nodes: health.number_of_nodes,
                        active_primary_shards: health.active_primary_shards,
                        active_shards: health.active_shards,
                        relocating_shards: health.relocating_shards,
                        initializing_shards: health.initializing_shards,
                        unassigned_shards: health.unassigned_shards
                    },
                    cluster_stats: {
                        indices_count: stats.indices?.count || 0,
                        docs_count: stats.indices?.docs?.count || 0,
                        store_size: stats.indices?.store?.size_in_bytes || 0
                    },
                    node_stats: Object.keys(nodes.nodes || {}).map(nodeId => {
                        const node = nodes.nodes[nodeId];
                        return {
                            name: node.name,
                            cpu_percent: node.os?.cpu?.percent || 0,
                            memory_used: node.jvm?.mem?.heap_used_in_bytes || 0,
                            memory_max: node.jvm?.mem?.heap_max_in_bytes || 0,
                            disk_available: node.fs?.total?.available_in_bytes || 0,
                            disk_total: node.fs?.total?.total_in_bytes || 0
                        };
                    })
                });
                
            } catch (containerError) {
                console.log(`Error getting Elasticsearch data from ${containerName}:`, containerError.message);
                elasticsearchData.push({
                    container: containerName,
                    error: 'Could not retrieve Elasticsearch metrics'
                });
            }
        }
        
        res.json({
            status: 'success',
            containers_found: esContainers.length,
            data: elasticsearchData
        });
        
    } catch (error) {
        console.log('Error getting Elasticsearch telemetrics:', error.message);
        res.json({
            status: 'error',
            message: 'Could not retrieve Elasticsearch telemetrics',
            error: error.message
        });
    }
});

// Send start command endpoint
app.post('/api/command/start', async (req, res) => {
    try {
        const { command, args = [] } = req.body;
        
        if (!command) {
            return res.status(400).json({ error: 'Command is required' });
        }
        
        console.log(`Executing start command: ${command} ${args.join(' ')}`);
        
        // Execute the command
        const fullCommand = args.length > 0 ? `${command} ${args.join(' ')}` : command;
        const { stdout, stderr } = await execPromise(fullCommand);
        
        console.log(`Start command output: ${stdout}`);
        if (stderr) {
            console.log(`Start command stderr: ${stderr}`);
        }
        
        // Store the command timestamp for frontend polling
        const timestamp = Date.now();
        global.lastStartCommand = {
            timestamp: timestamp,
            command: fullCommand,
            output: stdout
        };
        
        // Auto-clear after 5 seconds to prevent stale commands
        setTimeout(() => {
            if (global.lastStartCommand && global.lastStartCommand.timestamp === timestamp) {
                global.lastStartCommand = null;
            }
        }, 5000);
        
        res.json({
            success: true,
            command: fullCommand,
            output: stdout,
            error: stderr || null,
            message: `Command '${command}' started successfully`,
            timestamp: Date.now()
        });
        
    } catch (error) {
        console.error('Error executing start command:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: `Failed to execute command: ${error.message}`
        });
    }
});

// Get recent start commands for frontend polling
app.get('/api/command/recent', (req, res) => {
    res.json({
        lastStartCommand: global.lastStartCommand || null,
        lastPercentCommand: global.lastPercentCommand || null,
        lastModelCommand: global.lastModelCommand || null
    });
});

// Clear stored commands (useful for resetting state)
app.post('/api/command/clear', (req, res) => {
    global.lastStartCommand = null;
    global.lastPercentCommand = null;
    global.lastModelCommand = null;
    res.json({
        success: true,
        message: 'Stored commands cleared'
    });
});

// Send percent command endpoint
app.post('/api/command/percent', async (req, res) => {
    try {
        const { percent, action = 'set' } = req.body;
        
        if (percent === undefined || percent === null) {
            return res.status(400).json({ error: 'Percent value is required' });
        }
        
        const percentValue = parseFloat(percent);
        if (isNaN(percentValue) || percentValue < 0 || percentValue > 100) {
            return res.status(400).json({ error: 'Percent must be a number between 0 and 100' });
        }
        
        console.log(`Received percent command: ${percentValue}% (action: ${action})`);
        
        // Store the percent command for frontend polling
        const timestamp = Date.now();
        global.lastPercentCommand = {
            timestamp: timestamp,
            percent: percentValue,
            action: action
        };
        
        // Auto-clear after 5 seconds to prevent stale commands
        setTimeout(() => {
            if (global.lastPercentCommand && global.lastPercentCommand.timestamp === timestamp) {
                global.lastPercentCommand = null;
            }
        }, 5000);
        
        // Here you can add logic to handle the percentage value
        // For example, you could:
        // - Store it in a database
        // - Trigger specific actions based on the percentage
        // - Send it to other services
        // - Update system configurations
        
        let message = `Percent value ${percentValue}% received`;
        let additionalData = {};
        
        // Example: Different actions based on percentage ranges
        if (percentValue >= 90) {
            message += ' - High usage detected!';
            additionalData.alert = 'high_usage';
        } else if (percentValue >= 75) {
            message += ' - Moderate usage';
            additionalData.alert = 'moderate_usage';
        } else if (percentValue >= 50) {
            message += ' - Normal usage';
            additionalData.alert = 'normal_usage';
        } else {
            message += ' - Low usage';
            additionalData.alert = 'low_usage';
        }
        
        res.json({
            success: true,
            percent: percentValue,
            action: action,
            message: message,
            timestamp: new Date().toISOString(),
            ...additionalData
        });
        
    } catch (error) {
        console.error('Error processing percent command:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: `Failed to process percent command: ${error.message}`
        });
    }
});

// Get local models from ollama list command
app.get('/api/models/local', async (req, res) => {
    try {
        console.log('Executing ollama list command...');
        
        // Execute ollama list command
        const { stdout, stderr } = await execPromise('ollama list');
        
        if (stderr) {
            console.log('Ollama stderr:', stderr);
        }
        
        console.log('Ollama list output:', stdout);
        
        // Parse the ollama list output
        const models = [];
        const lines = stdout.trim().split('\n');
        
        // Skip the header line (NAME    ID    SIZE    MODIFIED)
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (line.trim()) {
                // Split by 4 spaces to handle the exact format
                // Format: NAME    ID    SIZE    MODIFIED (4 spaces between each)
                const parts = line.split('    ').filter(part => part.trim() !== '');
                
                if (parts.length >= 3) {
                    const name = parts[0].trim();
                    const id = parts[1].trim();
                    const sizeField = parts[2].trim();
                    
                    // Extract size with units (e.g., "986 MB", "1.2 GB")
                    let size = sizeField;
                    const sizeMatch = sizeField.match(/(\d+(?:\.\d+)?)\s*(GB|MB|KB)/i);
                    if (sizeMatch) {
                        const sizeValue = sizeMatch[1];
                        const unit = sizeMatch[2].toUpperCase();
                        size = `${sizeValue} ${unit}`;
                    }
                    
                    // Extract parameters from name (e.g., qwen2.5:1.5b -> 1.5B)
                    let parameters = null;
                    const paramMatch = name.match(/:(\d+\.?\d*[bkm]?)/i);
                    if (paramMatch) {
                        parameters = paramMatch[1].toUpperCase();
                        if (!parameters.endsWith('B')) {
                            parameters += 'B';
                        }
                    }
                    
                    const model = {
                        id: name.replace(':', '-'), // Use safe ID format
                        name: name,
                        size: size
                    };
                    
                    // Only add parameters if we found them
                    if (parameters) {
                        model.parameters = parameters;
                    }
                    
                    models.push(model);
                }
            }
        }
        
        console.log('Parsed models:', models);
        
        res.json({
            success: true,
            models: models
        });
        
    } catch (error) {
        console.error('Error getting local models from ollama:', error);
        
        // If ollama command fails, return empty array instead of error
        res.json({
            success: true,
            models: [],
            message: 'Ollama not available or no models installed'
        });
    }
});

// Start model download
app.post('/api/models/download/start', async (req, res) => {
    try {
        const { modelId, modelName } = req.body;
        
        if (!modelId || !modelName) {
            return res.status(400).json({ error: 'Model ID and name are required' });
        }
        
        console.log(`Starting download for model: ${modelName} (${modelId})`);
        
        res.json({
            success: true,
            message: `Started downloading ${modelName}`,
            modelId: modelId,
            modelName: modelName
        });
        
    } catch (error) {
        console.error('Error starting model download:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Stop model download
app.post('/api/models/download/stop', async (req, res) => {
    try {
        const { modelId, modelName } = req.body;
        
        if (!modelId || !modelName) {
            return res.status(400).json({ error: 'Model ID and name are required' });
        }
        
        console.log(`Stopping download for model: ${modelName} (${modelId})`);
        
        res.json({
            success: true,
            message: `Stopped downloading ${modelName}`,
            modelId: modelId,
            modelName: modelName
        });
        
    } catch (error) {
        console.error('Error stopping model download:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.post('/api/command/model', async (req, res) => {
    try {
        const { model, size, args = [] } = req.body;

        if (!model || !size) {
            return res.status(400).json({ error: 'Model and size are required' });
        }
        
        console.log(`Executing model command: ${model} ${size} ${args.join(' ')}`);
        
        // Execute the command
        const fullCommand = args.length > 0 ? `${model} ${size} ${args.join(' ')}` : `${model} ${size}`;
        const { stdout, stderr } = await execPromise(fullCommand);
        
        console.log(`Model command output: ${stdout}`);
        if (stderr) {
            console.log(`Model command stderr: ${stderr}`);
        }
        
        // Store the model command timestamp for frontend polling
        const timestamp = Date.now();
        global.lastModelCommand = {
            timestamp: timestamp,
            model: model,
            size: size,
            command: fullCommand,
            output: stdout
        };
        
        // Auto-clear after 5 seconds to prevent stale commands
        setTimeout(() => {
            if (global.lastModelCommand && global.lastModelCommand.timestamp === timestamp) {
                global.lastModelCommand = null;
            }
        }, 5000);
        
        res.json({
            success: true,
            model: model,
            size: size,
            command: fullCommand,
            output: stdout,
            error: stderr || null,
            message: `Model command '${model} ${size}' started successfully`,
            timestamp: Date.now()
        });
        
    } catch (error) {
        console.error('Error executing model command:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: `Failed to execute model command: ${error.message}`
        });
    }
});

// Store the custom name globally
let customName = 'Your Gal Box'; // Default name

// File path for persistent storage
const nameFilePath = './custom_name.json';

// Load custom name from file on startup
function loadCustomName() {
    try {
        if (fs.existsSync(nameFilePath)) {
            const data = fs.readFileSync(nameFilePath, 'utf8');
            const parsed = JSON.parse(data);
            customName = parsed.name || 'Your Gal Box';
            console.log(`Loaded custom name from file: ${customName}`);
        } else {
            console.log('No custom name file found, using default name');
        }
    } catch (error) {
        console.error('Error loading custom name from file:', error);
        customName = 'Your Gal Box';
    }
}

// Save custom name to file
function saveCustomName(name) {
    try {
        const data = JSON.stringify({ name: name, timestamp: new Date().toISOString() });
        fs.writeFileSync(nameFilePath, data, 'utf8');
        console.log(`Saved custom name to file: ${name}`);
    } catch (error) {
        console.error('Error saving custom name to file:', error);
    }
}

// Load the custom name when the server starts
loadCustomName();

// Set custom name endpoint
app.post('/api/name', async (req, res) => {
    try {
        const { name } = req.body;
        
        if (!name || typeof name !== 'string') {
            return res.status(400).json({ error: 'Name is required and must be a string' });
        }
        
        // Trim and validate name length
        const trimmedName = name.trim();
        if (trimmedName.length === 0) {
            return res.status(400).json({ error: 'Name cannot be empty' });
        }
        
        if (trimmedName.length > 100) {
            return res.status(400).json({ error: 'Name must be 100 characters or less' });
        }
        
        customName = trimmedName;
        console.log(`Custom name updated to: ${customName}`);
        
        // Save the name to file for persistence
        saveCustomName(customName);
        
        res.json({
            success: true,
            name: customName,
            message: `Name updated to "${customName}"`,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error setting custom name:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: `Failed to set name: ${error.message}`
        });
    }
});

// Get custom name endpoint
app.get('/api/name', (req, res) => {
    res.json({
        name: customName,
        timestamp: new Date().toISOString()
    });
});

// Handle preflight requests for images endpoint
app.options('/api/images', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.sendStatus(200);
});

// Images API endpoint
app.get('/api/images', (req, res) => {
    const fs = require('fs');
    const path = require('path');
    
    console.log('Images API called from:', req.headers.origin);
    console.log('Request headers:', req.headers);
    
    try {
        const pngDir = path.join(__dirname, '../public/png');
        
        // Check if png directory exists
        if (!fs.existsSync(pngDir)) {
            // Create directory if it doesn't exist
            fs.mkdirSync(pngDir, { recursive: true });
            console.log('Created png directory:', pngDir);
        }
        
        // Read all files from the png directory
        const files = fs.readdirSync(pngDir);
        
        // Filter for image files
        const imageFiles = files.filter(file => {
            const ext = path.extname(file).toLowerCase();
            return ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(ext);
        });
        
        // Convert to image objects
        const images = imageFiles.map(file => ({
            src: `/png/${file}`,
            name: path.basename(file, path.extname(file))
        }));
        
        console.log(`Found ${images.length} images in png directory`);
        res.json(images);
        
    } catch (error) {
        console.error('Error reading png directory:', error);
        res.status(500).json({
            error: 'Failed to read images directory',
            message: error.message
        });
    }
});

// Helper function to parse network bytes
function parseNetworkBytes(str) {
    const units = { 'B': 1, 'kB': 1000, 'MB': 1000000, 'GB': 1000000000 };
    const match = str.match(/^([\d.]+)([a-zA-Z]+)$/);
    if (match) {
        const value = parseFloat(match[1]);
        const unit = match[2];
        return value * (units[unit] || 1);
    }
    return 0;
}

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
}); 
