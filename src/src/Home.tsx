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

const Home: React.FC<HomeProps> = ({ title = 'Welcome to Screen Script' }) => {
  const [IP, setIP] = useState<string>('192.168.1.69');
  const [Wifi, setWifi] = useState<string>('Loading...');
  const [CPU, setCPU] = useState<string>('Loading...');
  const [lastUpdate, setLastUpdate] = useState<string>('');

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
        </div>
      </div>
    </div>
  );
};

export default Home; 