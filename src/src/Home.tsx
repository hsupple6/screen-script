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
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const baseProgressRef = useRef<number>(0); // Base progress from commands
  const startTimeRef = useRef<number>(0); // When the current timer segment started

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
    baseProgressRef.current = 0;
    
    // Start the 3-minute update process
    startUpdateProcess();
  };

  // Function to check for recent start commands from backend
  const checkForStartCommands = async () => {
    try {
      // You could add a new endpoint to check recent commands, or
      // for now, we'll use a simple approach - check if the backend is responding
      const response = await fetch('http://localhost:5421/api/system/cpu');
      if (response.ok) {
        // Backend is running, could trigger animation here
        // For now, we'll rely on manual trigger or the button
      }
    } catch (error) {
      console.log('Backend not available');
    }
  };

    // Function to start the update process (3 minutes to 100%)
  const startUpdateProcess = () => {
    // Clear any existing interval
    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
    }
    
    startTimeRef.current = Date.now();
    const duration = 3 * 60 * 1000; // 3 minutes total duration
    const progressPerMs = 100 / duration; // Progress per millisecond
    
    updateIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const timerProgress = elapsed * progressPerMs; // Progress from timer
      const totalProgress = Math.min(baseProgressRef.current + timerProgress, 100);
      
      // Update CSS custom properties exactly like Console component
      updateProgressCircle(updateProgressRef.current, totalProgress, '--docker-percentage');
      updateEndWrapper(updateEndWrapperRef.current, totalProgress);
      
      // Update state
      setUpdateProgress(totalProgress);
      
             // Stop at 100% (will be handled by completion command)
       if (totalProgress >= 100) {
         if (updateIntervalRef.current) {
           clearInterval(updateIntervalRef.current);
           updateIntervalRef.current = null;
         }
         setUpdateMessage('Waiting for completion...');
       }
    }, 100); // Update every 100ms for smooth animation
  };

  // Function to set a new base progress and restart timer
  const setProgressAndContinue = (newProgress: number) => {
    // Set the new base progress
    baseProgressRef.current = newProgress;
    
    // Update display immediately
    updateProgressCircle(updateProgressRef.current, newProgress, '--docker-percentage');
    updateEndWrapper(updateEndWrapperRef.current, newProgress);
    setUpdateProgress(newProgress);
    
    // If we're not at 100%, restart the timer
    if (newProgress < 100) {
      startUpdateProcess();
    }
  };

  // Function to animate dial to 0 and disappear
  const animateDialToZero = () => {
    setUpdateMessage('Finalizing...');
    
    // Smooth animation to 0 over 1 second
    const animationDuration = 1000;
    const startTime = Date.now();
    const startProgress = updateProgress;
    
    const animateDown = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / animationDuration, 1);
      
      // Ease-out animation
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const currentProgress = startProgress * (1 - easeOut);
      
      // Update both the dial slider and the number
      updateProgressCircle(updateProgressRef.current, currentProgress, '--docker-percentage');
      updateEndWrapper(updateEndWrapperRef.current, currentProgress);
      setUpdateProgress(currentProgress);
      
      if (progress < 1) {
        requestAnimationFrame(animateDown);
      } else {
        // Animation to 0 complete, now do the spectacular closing
        setUpdateMessage('Complete!');
        setTimeout(() => {
          spectacularClose();
        }, 500);
      }
    };
    
    requestAnimationFrame(animateDown);
  };
  
  // Spectacular closing animation
  const spectacularClose = () => {
    const homeCover = document.querySelector('.home-cover');
    if (homeCover) {
      // Add multiple animation classes for a spectacular effect
      homeCover.classList.add('spectacular-close');
      
      // Pulse effect on the dial
      const dialContainer = homeCover.querySelector('.storage-status-container');
      if (dialContainer) {
        (dialContainer as HTMLElement).classList.add('dial-pulse-out');
      }
      
             // Clean up after animation
       setTimeout(() => {
         setIsStartAnimation(false);
         setIsUpdating(false);
         setUpdateProgress(0);
         setUpdateMessage('Starting Update...');
         baseProgressRef.current = 0;
         
         if (homeCover) {
           homeCover.classList.remove('spectacular-close');
         }
         if (dialContainer) {
           (dialContainer as HTMLElement).classList.remove('dial-pulse-out');
         }
       }, 1500);
    }
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
    if (!isUpdating) return;
    
    console.log('Updating progress to:', percent);
    
    // If percent is 100, immediately complete
    if (percent >= 100) {
      // Clear timer
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
        updateIntervalRef.current = null;
      }
      
      // Set to 100% and complete
      updateProgressCircle(updateProgressRef.current, 100, '--docker-percentage');
      updateEndWrapper(updateEndWrapperRef.current, 100);
      setUpdateProgress(100);
      
      // Trigger completion sequence
      setUpdateMessage('Update Complete');
      setTimeout(() => {
        setUpdateMessage('Finished Update');
        setTimeout(() => {
          animateDialToZero();
        }, 2000);
      }, 3000);
      return;
    }
    
    // For non-100% commands, set new progress and continue
    setProgressAndContinue(percent);
  };

  // Listen for start commands (you can call this from browser console or external scripts)
  useEffect(() => {
    // Make the function globally available
    (window as any).triggerStartAnimation = triggerStartAnimation;
    
    return () => {
      delete (window as any).triggerStartAnimation;
    };
  }, []);

  // Poll for recent commands from backend
  useEffect(() => {
    let lastStartTimestamp = 0;
    let lastPercentTimestamp = 0;
    let isProcessing = false;
    
    const pollForCommands = async () => {
      if (isProcessing) return; // Prevent overlapping polls
      isProcessing = true;
      
      try {
        const response = await fetch('http://localhost:5421/api/command/recent');
        if (response.ok) {
          const data = await response.json();
          
          // Check for new start commands (only if not already updating)
          if (data.lastStartCommand && data.lastStartCommand.timestamp > lastStartTimestamp && !isUpdating) {
            lastStartTimestamp = data.lastStartCommand.timestamp;
            console.log('New start command detected:', data.lastStartCommand);
            
            // Clear immediately to prevent re-triggering
            await fetch('http://localhost:5421/api/command/clear', { method: 'POST' }).catch(() => {});
            
            // Trigger animation after clearing
            triggerStartAnimation();
          }
          
          // Check for new percent commands
          if (data.lastPercentCommand && data.lastPercentCommand.timestamp > lastPercentTimestamp) {
            lastPercentTimestamp = data.lastPercentCommand.timestamp;
            console.log('New percent command detected:', data.lastPercentCommand);
            
            if (isUpdating) {
              handlePercentDuringUpdate(data.lastPercentCommand.percent);
              
              // If it's a 100% command, clear the stored commands
              if (data.lastPercentCommand.percent >= 100) {
                await fetch('http://localhost:5421/api/command/clear', { method: 'POST' }).catch(() => {});
              }
            }
          }
        }
      } catch (error) {
        // Backend might not be running, ignore errors
        console.log('Polling error:', error);
      } finally {
        isProcessing = false;
      }
    };
    
    // Poll more frequently for better responsiveness
    const interval = setInterval(pollForCommands, 500);
    
    return () => clearInterval(interval);
  }, [isUpdating]);

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
          <div className="storage-status-container" style={{position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "400px", height: "400px", zIndex: 10002}}>
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