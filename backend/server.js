const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const util = require('util');
const os = require('os');
const fs = require('fs');
const execPromise = util.promisify(exec);

const app = express();
const port = 5421;

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