import React, { useState, useEffect } from 'react';
import './Spaces.css';
import InfoBox from './InfoBox';

interface Connection {
    id: string;
    name: string;
    type: string;
    status: string;
  }

interface LocalModel {
  id: string;
  name: string;
  parameters: string;
  size: string;
  isDownloading?: boolean;
}

interface HomeProps {
  title?: string;
}

const Spaces: React.FC<HomeProps> = ({ title = 'Welcome to Screen Script' }) => {
  const [IP, setIP] = useState<string>('192.168.1.69');
  const [localModels, setLocalModels] = useState<LocalModel[]>([]);
  const [downloadingModels, setDownloadingModels] = useState<Set<string>>(new Set());

  const [connections, setConnections] = useState<Connection[]>([
    { id: '1', name: 'Main Connection', type: 'WiFi', status: 'Connected' }
  ]);

  // Fetch local models
  useEffect(() => {
    const fetchLocalModels = async () => {
      try {
        const response = await fetch('http://localhost:5421/api/models/local');
        if (response.ok) {
          const data = await response.json();
          setLocalModels(data.models || []);
        }
      } catch (error) {
        console.log('Error fetching local models:', error);
      }
    };

    fetchLocalModels();
    
    // Refresh every 5 seconds
    const interval = setInterval(fetchLocalModels, 5000);
    
    return () => clearInterval(interval);
  }, []);

  // Function to start model download
  const startModelDownload = async (modelId: string, modelName: string) => {
    try {
      const response = await fetch('http://localhost:5421/api/models/download/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ modelId, modelName }),
      });
      
      if (response.ok) {
        setDownloadingModels(prev => new Set(prev).add(modelId));
        console.log(`Started downloading ${modelName}`);
      }
    } catch (error) {
      console.error('Error starting model download:', error);
    }
  };

  // Function to stop model download
  const stopModelDownload = async (modelId: string, modelName: string) => {
    try {
      const response = await fetch('http://localhost:5421/api/models/download/stop', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ modelId, modelName }),
      });
      
      if (response.ok) {
        setDownloadingModels(prev => {
          const newSet = new Set(prev);
          newSet.delete(modelId);
          return newSet;
        });
        console.log(`Stopped downloading ${modelName}`);
      }
    } catch (error) {
      console.error('Error stopping model download:', error);
    }
  };

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
        
        <div className="models-section">
          <div className="models-title">Available Local Models</div>
          <div className="models-grid">
            {localModels.map((model) => (
              <div 
                key={model.id} 
                className={`model-card ${downloadingModels.has(model.id) ? 'downloading' : ''}`}
                onClick={() => {
                  if (downloadingModels.has(model.id)) {
                    stopModelDownload(model.id, model.name);
                  } else {
                    startModelDownload(model.id, model.name);
                  }
                }}
              >
                <div className="model-name">{model.name}</div>
                <div className="model-details">
                  <div className="model-stat">
                    <div className="stat-value">{model.parameters}</div>
                    <div className="stat-label">Parameters</div>
                  </div>
                  <div className="model-stat">
                    <div className="stat-value">{model.size}</div>
                    <div className="stat-label">GB</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
    </div>
  );
};

export default Spaces; 