import React, { useState } from 'react';
import './Spaces.css';
import InfoBox from './InfoBox';

interface Connection {
    id: string;
    name: string;
    type: string;
    status: string;
  }

interface HomeProps {
  title?: string;
}

const Spaces: React.FC<HomeProps> = ({ title = 'Welcome to Screen Script' }) => {
  const [IP, setIP] = useState<string>('192.168.1.69');

  const [connections, setConnections] = useState<Connection[]>([
    { id: '1', name: 'Main Connection', type: 'WiFi', status: 'Connected' },
    { id: '2', name: 'Backup Connection', type: 'Ethernet', status: 'Standby' }
  ]);

  const addConnection = (newConnection: Connection) => {
    setConnections(prev => [...prev, newConnection]);
  };

  const simulateNewConnection = () => {
    const newConnection: Connection = {
      id: Date.now().toString(),
      name: `Connection ${connections.length + 1}`,
      type: 'WiFi',
      status: 'Connected'
    };
    addConnection(newConnection);
  };

  return (
    <div className='Spaces'>
        <div className='spaces-container'>
            {connections.map(connection => (
              <InfoBox
                key={connection.id}
                title={`${connection.type} - ${connection.name}`}
                value={connection.status}
                style={{
                  backgroundColor: connection.status === 'Connected' ? '#4CAF50' : '#FFA726'
                }}
              />
            ))}
        </div>
    </div>
  );
};

export default Spaces; 