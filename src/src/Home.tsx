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
    // WebSocket connection
    const ws = new WebSocket('ws://localhost:3002');

    ws.onopen = () => {
      console.log('Connected to WebSocket server');
    };

    ws.onmessage = (event) => {
      const data: SystemData = JSON.parse(event.data);
      setWifi(data.wifi);
      setCPU(data.cpu);
      setLastUpdate(new Date(data.timestamp).toLocaleTimeString());
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('Disconnected from WebSocket server');
    };

    // Cleanup on unmount
    return () => {
      ws.close();
    };
  }, []);

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
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchGalOSApps, 30000);
    
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
        <div className = "welcome-message">
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
          <InfoBox title="CPU Usage" value={CPU} />
          <InfoBox title="Last Update" value={lastUpdate} />
          
          {/* GalOS Connection Status */}
          <InfoBox 
            title="GalOS Status" 
            value={galOSConnected ? "Connected" : "Mock Data"} 
            style={{
              backgroundColor: galOSConnected ? '#4CAF50' : '#FFA726'
            }}
          />
          
          {/* GalOS Applications */}
          <div className="galos-apps-section">
            <div style={{fontSize: "1.2vw", marginBottom: "10px", textAlign: "center"}}>
              GalOS Applications
            </div>
            {galOSApps.map(app => (
              <InfoBox
                key={app.id}
                title={`${app.title} (${app.type})`}
                value={`${getStatusText(app.status)} | ${app.memoryUsage} | ${app.cpuUsage}`}
                style={{
                  backgroundColor: getStatusColor(app.status),
                  marginBottom: '8px',
                  fontSize: '0.9vw'
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home; 