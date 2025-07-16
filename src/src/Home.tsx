import React, { useState, useEffect, useRef } from 'react';
import './Home.css';
import GalLogo from './png/GalLogo.png'
import Console from './src/Console'
import Spaces from './src/Spaces';
import InfoBox from './src/InfoBox';
import './src/InfoBox.css';

// AnimatedNumber component (copied from Console.tsx)
interface AnimatedNumberProps {
  value: number;
  duration?: number;
  decimals?: number;
}

const AnimatedNumber: React.FC<AnimatedNumberProps> = ({ value, duration = 1000, decimals = 0 }) => {
  const [displayValue, setDisplayValue] = useState(value);
  const [isAnimating, setIsAnimating] = useState(false);
  const animationRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (displayValue !== value) {
      setIsAnimating(true);
      const startValue = displayValue;
      const difference = value - startValue;
      const startTime = Date.now();

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function (ease-in-out)
        const easeInOut = progress < 0.5 
          ? 2 * progress * progress 
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;
        
        const currentValue = startValue + (difference * easeInOut);
        if (decimals > 0) {
          setDisplayValue(parseFloat(currentValue.toFixed(decimals)));
        } else {
          setDisplayValue(Math.round(currentValue));
        }

        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate);
        } else {
          setIsAnimating(false);
        }
      };

      animationRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [value, duration, decimals]);

  return <span>{decimals > 0 ? displayValue.toFixed(decimals) : displayValue}</span>;
};

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

interface PercentCircle {
  id: string;
  percent: number;
  timestamp: Date;
  alert?: string;
}

const Home: React.FC<HomeProps> = ({ title = 'Welcome to Screen Script' }) => {
  const [IP, setIP] = useState<string>('192.168.1.69');
  const [Wifi, setWifi] = useState<string>('Loading...');
  const [CPU, setCPU] = useState<string>('Loading...');
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [galOSApps, setGalOSApps] = useState<GalOSApp[]>([]);
  const [galOSConnected, setGalOSConnected] = useState<boolean>(false);
  
  // Screen script states
  const [isStartAnimation, setIsStartAnimation] = useState<boolean>(false);
  const [percentCircles, setPercentCircles] = useState<PercentCircle[]>([]);
  const [galOSStarted, setGalOSStarted] = useState<boolean>(false);
  
  // Update dial states
  const [updateProgress, setUpdateProgress] = useState<number>(0);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [updateMessage, setUpdateMessage] = useState<string>('Starting Update...');
  const updateProgressRef = useRef<HTMLDivElement>(null);
  const updateEndWrapperRef = useRef<HTMLDivElement>(null);

  // Function to handle start command
  const handleStartCommand = async (command: string, args: string[] = []) => {
    try {
      const response = await fetch('http://localhost:5421/api/command/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ command, args }),
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Start command response:', data);
        
        // Trigger the shrinking animation
        setIsStartAnimation(true);
        
        // Reset animation after 3 seconds
        setTimeout(() => {
          setIsStartAnimation(false);
        }, 3000);
        
        return data;
      }
    } catch (error) {
      console.error('Error sending start command:', error);
    }
  };

  // Function to handle percent command
  const handlePercentCommand = async (percent: number) => {
    try {
      const response = await fetch('http://localhost:5421/api/command/percent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ percent }),
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Percent command response:', data);
        
        // If we're in update mode, update the dial
        if (isUpdating) {
          handlePercentDuringUpdate(data.percent);
        } else {
          // Add new percent circle for non-update mode
          const newCircle: PercentCircle = {
            id: Date.now().toString(),
            percent: data.percent,
            timestamp: new Date(),
            alert: data.alert
          };
          
          setPercentCircles(prev => [...prev, newCircle]);
          
          // Remove circle after 5 seconds
          setTimeout(() => {
            setPercentCircles(prev => prev.filter(circle => circle.id !== newCircle.id));
          }, 5000);
        }
        
        return data;
      }
    } catch (error) {
      console.error('Error sending percent command:', error);
    }
  };

  // Demo functions for testing
  const demoStartCommand = () => {
    handleStartCommand('echo', ['GalOS Starting...']);
  };

  const demoPercentCommand = () => {
    const randomPercent = Math.floor(Math.random() * 100);
    handlePercentCommand(randomPercent);
  };

  // Function to trigger start animation from external command
  const triggerStartAnimation = () => {
    setIsStartAnimation(true);
    setIsUpdating(true);
    setUpdateProgress(0);
    setUpdateMessage('Starting Update...');
    
    // Start the update process
    startUpdateProcess();
  };

  // Function to start the update process
  const startUpdateProcess = () => {
    // Simulate progress updates
    const interval = setInterval(() => {
      setUpdateProgress(prev => {
        const newProgress = Math.min(prev + Math.random() * 15, 100); // Random progress increments
        
        if (newProgress >= 100) {
          clearInterval(interval);
          const finalProgress = 100;
          
                // Update CSS custom properties exactly like Console component
      updateProgressCircle(updateProgressRef.current, finalProgress, '--docker-percentage');
      updateEndWrapper(updateEndWrapperRef.current, finalProgress);
          
          // Wait 3 seconds then show "Finished Update"
          setTimeout(() => {
            setUpdateMessage('Finished Update');
            // After showing "Finished Update", animate dial to 0 and disappear
            setTimeout(() => {
              animateDialToZero();
            }, 2000);
          }, 3000);
          return finalProgress;
        }
        
        // Update CSS custom properties exactly like Console component
        updateProgressCircle(updateProgressRef.current, newProgress, '--docker-percentage');
        updateEndWrapper(updateEndWrapperRef.current, newProgress);
        
        return newProgress;
      });
    }, 500);
  };

  // Function to animate dial to 0 and disappear
  const animateDialToZero = () => {
    // Animate dial to 0
    setUpdateProgress(0);
    
    // After dial reaches 0, animate diameter and background
    setTimeout(() => {
      // Add CSS class for diameter animation
      const homeCover = document.querySelector('.home-cover');
      if (homeCover) {
        homeCover.classList.add('dial-complete');
      }
      
      // Remove the cover after animation
      setTimeout(() => {
        setIsStartAnimation(false);
        setIsUpdating(false);
        setUpdateProgress(0);
        setUpdateMessage('Starting Update...');
        if (homeCover) {
          homeCover.classList.remove('dial-complete');
        }
      }, 2000);
    }, 1000);
  };

  // Function to update progress circle using CSS custom properties
  const updateProgressCircle = (element: HTMLDivElement | null, value: number, property: string) => {
    if (element) {
      console.log('Setting CSS property:', property, 'to:', value);
      element.style.setProperty(property, value.toString());
    } else {
      console.log('Element not found for progress circle');
    }
  };

  // Function to update end wrapper rotation
  const updateEndWrapper = (element: HTMLDivElement | null, value: number) => {
    if (element) {
      element.style.transform = `rotate(${value * 2.7}deg)`;
    }
  };

  // Function to handle percent command during update
  const handlePercentDuringUpdate = (percent: number) => {
    if (isUpdating) {
      console.log('Updating progress to:', percent);
      
      // Update CSS custom properties exactly like Console component
      updateProgressCircle(updateProgressRef.current, percent, '--docker-percentage');
      updateEndWrapper(updateEndWrapperRef.current, percent);
      
      // Update state after CSS properties (like Console component)
      setUpdateProgress(percent);
      
      if (percent >= 100) {
        setUpdateMessage('Update Complete');
        // Wait 3 seconds then show "Finished Update"
        setTimeout(() => {
          setUpdateMessage('Finished Update');
          // After showing "Finished Update", animate dial to 0 and disappear
          setTimeout(() => {
            animateDialToZero();
          }, 2000);
        }, 3000);
      }
    }
  };

  // Listen for start commands (you can call this from browser console or external scripts)
  useEffect(() => {
    // Make the function globally available
    (window as any).triggerStartAnimation = triggerStartAnimation;
    
    return () => {
      delete (window as any).triggerStartAnimation;
    };
  }, []);

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
      <div className="home-cover"
      style = {{opacity: isStartAnimation ? 1 : 0}}>
        {/* Update Dial */}
        {isUpdating && (
          <div className="storage-status-container" style={{position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "500px", height: "500px", zIndex: 10002}}>
            <div className="docker-status-dial">
              <div className="dial-container">
                <div className="dial-background" style={{background: "#006400"}}>
                </div>
                <div 
                  ref={updateProgressRef}
                  className="progress-circle docker-progress-circle"
                  style={{'transform': 'rotate(-45deg)'} as React.CSSProperties}
                />
                <div className="cover-circle" style={{background: "RGB(8,8,8)", zIndex: 4, width: "80%", height: "80%", position: "absolute", borderRadius: "50%"}}>
                  <div className="dial-text">
                    <div className="usage-text" style={{fontSize: "2vw", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", justifyContent: "center"}}>
                      <div>{updateMessage}</div>
                      <div style={{fontSize: "1.5vw"}}>
                        <AnimatedNumber value={updateProgress} duration={500} />%
                      </div>
                    </div>
                  </div>
                </div>
                <div className="dial-start-point" style={{background: "#006400"}}></div>
                <div ref={updateEndWrapperRef} className="dial-end-wrapper">
                  <div 
                    className="dial-end-point" style={{background: "#006400"}}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Start Command Button */}
      <button 
        onClick={triggerStartAnimation}
        className="start-command-btn"
        style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          zIndex: 10001,
          padding: '10px 20px',
          backgroundColor: '#4CAF50',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: 'bold'
        }}
      >
        Start Command
      </button>
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