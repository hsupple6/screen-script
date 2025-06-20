import React, { useState, useEffect } from 'react';
import './Home.css';
import GalLogo from './png/GalLogo.png'
import Console from './src/Console'
import Spaces from './src/Spaces';
import InfoBox from './src/InfoBox';
import './src/InfoBox.css';

interface HomeProps {
  title?: string;
}

interface SystemData {
  wifi: string;
  cpu: string;
  timestamp: string;
}

interface GalOSApp {
  id: string;
  title: string;
  status: 'running' | 'stopped' | 'loading';
  type: string;
  lastActivity?: string;
  memoryUsage?: string;
  cpuUsage?: string;
}

const Home: React.FC<HomeProps> = ({ title = 'Welcome to Screen Script' }) => {
  const [IP, setIP] = useState<string>('192.168.1.69');
  const [Wifi, setWifi] = useState<string>('Loading...');
  const [CPU, setCPU] = useState<string>('Loading...');
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [galOSApps, setGalOSApps] = useState<GalOSApp[]>([]);
  const [galOSConnected, setGalOSConnected] = useState<boolean>(false);

  useEffect(() => {
    // WebSocket connection disabled - using REST API instead
    // const ws = new WebSocket('ws://localhost:5421');
    // ws.onopen = () => console.log('Connected to WebSocket server');
    // ws.onmessage = (event) => {
    //   const data: SystemData = JSON.parse(event.data);
    //   setWifi(data.wifi);
    //   setCPU(data.cpu);
    //   setLastUpdate(new Date(data.timestamp).toLocaleTimeString());
    // };
    // ws.onerror = (error) => console.error('WebSocket error:', error);
    // ws.onclose = () => console.log('Disconnected from WebSocket server');
    // return () => ws.close();
  }, []);

  const getWifiStatus = async () => {
    try {
      const response = await fetch('http://localhost:5421/api/wifi');
      if (response.ok) {
        const data = await response.json();
        return data.SSID || 0;
      }
    } catch (error) {
      return "No Connection Detected";
    }
  };

  const getCPUUsage = async (): Promise<number> => {
    try {
      // Try system CPU first (more reliable)
      const response = await fetch('http://localhost:5421/api/system/cpu');
      if (response.ok) {
        const data = await response.json();
        console.log('CPU API response:', data);
        return data.usage || 0;
      }
    } catch (error) {
      console.log('System CPU API failed, trying Elasticsearch:', error);
      // Fallback to Elasticsearch CPU
      try {
        const response = await fetch('http://localhost:5421/api/system/elasticsearch');
        if (response.ok) {
          const data = await response.json();
          console.log('Elasticsearch API response:', data);
          // Get CPU from the first Elasticsearch node
          if (data.data && data.data.length > 0 && data.data[0].node_stats && data.data[0].node_stats.length > 0) {
            return data.data[0].node_stats[0].cpu_percent || 0;
          }
        }
      } catch (esError) {
        console.log('Elasticsearch CPU API also failed:', esError);
      }
    }
    console.log('Both CPU APIs failed, returning 0');
    return 0;
  };

  // Fetch GalOS applications
  useEffect(() => {
    const fetchGalOSApps = async () => {
      try {
        // Try to connect to GalOS backend
        const response = await fetch('http://localhost:3000/api/apps', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const apps = await response.json();
          setGalOSApps(apps);
          setGalOSConnected(true);
        } else {
          // If GalOS is not available, use mock data
          setGalOSApps([
            { id: '1', title: 'Chat', status: 'running', type: 'AI Assistant', lastActivity: '2 min ago', memoryUsage: '45MB', cpuUsage: '12%' },
            { id: '2', title: 'Console', status: 'running', type: 'Terminal', lastActivity: '1 min ago', memoryUsage: '23MB', cpuUsage: '8%' },
            { id: '3', title: 'Browser', status: 'running', type: 'Web Browser', lastActivity: '5 min ago', memoryUsage: '156MB', cpuUsage: '25%' },
            { id: '4', title: 'Notes', status: 'stopped', type: 'Text Editor', lastActivity: '10 min ago', memoryUsage: '0MB', cpuUsage: '0%' },
            { id: '5', title: 'Neurvana', status: 'loading', type: 'AI Model', lastActivity: 'Just now', memoryUsage: '89MB', cpuUsage: '18%' },
            { id: '6', title: 'Settings', status: 'running', type: 'System', lastActivity: '15 min ago', memoryUsage: '12MB', cpuUsage: '3%' }
          ]);
          setGalOSConnected(false);
        }
      } catch (error) {
        console.log('GalOS not available, using mock data');
        // Mock data when GalOS is not available
        setGalOSApps([
          { id: '1', title: 'Chat', status: 'running', type: 'AI Assistant', lastActivity: '2 min ago', memoryUsage: '45MB', cpuUsage: '12%' },
          { id: '2', title: 'Console', status: 'running', type: 'Terminal', lastActivity: '1 min ago', memoryUsage: '23MB', cpuUsage: '8%' },
          { id: '3', title: 'Browser', status: 'running', type: 'Web Browser', lastActivity: '5 min ago', memoryUsage: '156MB', cpuUsage: '25%' },
          { id: '4', title: 'Notes', status: 'stopped', type: 'Text Editor', lastActivity: '10 min ago', memoryUsage: '0MB', cpuUsage: '0%' },
          { id: '5', title: 'Neurvana', status: 'loading', type: 'AI Model', lastActivity: 'Just now', memoryUsage: '89MB', cpuUsage: '18%' },
          { id: '6', title: 'Settings', status: 'running', type: 'System', lastActivity: '15 min ago', memoryUsage: '12MB', cpuUsage: '3%' }
        ]);
        setGalOSConnected(false);
      }
    };

    fetchGalOSApps();
    
    // Get initial CPU usage
    const updateCPU = async () => {
      try {
        console.log('Fetching CPU usage...');
        const cpuUsage = await getCPUUsage();
        console.log('CPU usage received:', cpuUsage);
        setCPU(cpuUsage.toString());
      } catch (error) {
        console.error('Error updating CPU:', error);
        setCPU('Error');
      }
    };
    updateCPU();
    
    // Refresh every 30 seconds
    const interval = setInterval(() => {
      fetchGalOSApps();
      updateCPU();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return '#4CAF50';
      case 'loading':
        return '#FFA726';
      case 'stopped':
        return '#F44336';
      default:
        return '#9E9E9E';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'running':
        return 'Active';
      case 'loading':
        return 'Starting';
      case 'stopped':
        return 'Stopped';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className="home-container">
      <div className="home-background" />
      <div className='home-head'>
        <img src={GalLogo} alt="Gal Logo" 
        style = {{zIndex: "3"}}/>
        <div className = "welcome-message" style = {{position: "absolute", top: "50%", padding: "10px"}}>
          Welcome Hayden!
        </div>
        <div className='welcome-fade'></div>
      </div>
      <Console/>
      <Spaces/>
      <div className="home-content">
        <div className="home-info">
          <div style = {{fontSize: "3vw"}}>Your Gal Box</div>
          <InfoBox title="IP Address" value={IP} />
          <InfoBox title="Connected Wifi" value={Wifi} />
          <InfoBox title="CPU Usage" value={CPU + "%"} />
        </div>
      </div>
    </div>
  );
};

export default Home; 