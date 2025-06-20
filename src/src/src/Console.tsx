import React, { useState, useEffect, useRef } from 'react';
import './Console.css';
import GalLogo from './png/GalLogo.png'

interface HomeProps {
  title?: string;
}

interface SystemMetrics {
  ramUsage: number;
  storageUsage: number;
  galosStatus: number;
}

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

const Console: React.FC<HomeProps> = ({ title = 'Welcome to Screen Script' }) => {
  const [IP, setIP] = useState<string>('192.168.1.69');
  const [ramUsage, setRamUsage] = useState<number>(0);
  const [totalRam, setTotalRam] = useState<number>(0);
  const [storageUsage, setStorageUsage] = useState<number>(0);
  const [totalStorage, setTotalStorage] = useState<number>(0);
  const [dockerStatus, setDockerStatus] = useState<number>(0);
  const [dockerImages, setDockerImages] = useState<number>(0);
  const [startGalos, setStartGalos] = useState<number>(0);
  
  // Refs for accessing DOM elements to update CSS custom properties
  const ramProgressRef = useRef<HTMLDivElement>(null);
  const storageProgressRef = useRef<HTMLDivElement>(null);
  const dockerProgressRef = useRef<HTMLDivElement>(null);
  const ramEndWrapperRef = useRef<HTMLDivElement>(null);
  const storageEndWrapperRef = useRef<HTMLDivElement>(null);
  const dockerEndWrapperRef = useRef<HTMLDivElement>(null);

  // Get RAM usage
  const getRamUsage = async (): Promise<number> => {
    try {
      // Get actual system RAM from backend
      const response = await fetch('http://localhost:5421/api/system/ram');
      if (response.ok) {
        const data = await response.json();
        setTotalRam(data.total || 0);
        return data.usage || 0;
      }
    } catch (error) {
      console.log('Backend RAM data not available, using mock data');
    }

    // Mock data if backend not available
    return 0;
  };

  // Get system disk storage usage
  const getStorageUsage = async (): Promise<number> => {
    try {
      // Get actual disk storage from backend
      const response = await fetch('http://localhost:5421/api/system/storage');
      if (response.ok) {
        const data = await response.json();
        setTotalStorage(data.used);
        return data.usage || 0;
      }
    } catch (error) {
      console.log('Backend storage data not available, using mock data');
    }

    // Mock data if backend not available
    return 0;
  };

  // Get Docker status
  const getDockerStatus = async (): Promise<number> => {
    try {
      const response = await fetch('http://localhost:5421/api/system/docker');
      if (response.ok) {
        const data = await response.json();
        setDockerImages(data.containers || 0);
        return data.containers * 25 || 0;
      }
    } catch (error) {
      console.log('Backend Docker data not available, using mock data');
    }

    // Mock data if backend not available
    return 0;
  };

  // Update progress circle using CSS custom properties (like the speedometer)
  const updateProgressCircle = (element: HTMLDivElement | null, value: number, property: string) => {
    if (element) {
      element.style.setProperty(property, value.toString());
    }
  };

  // Update end wrapper rotation
  const updateEndWrapper = (element: HTMLDivElement | null, value: number) => {
    if (element) {
      element.style.transform = `rotate(${value * 2.7}deg)`;
    }
  };

  // Fetch all metrics
  const fetchMetrics = async () => {
    try {
      const [ram, storage, docker] = await Promise.all([
        getRamUsage(),
        getStorageUsage(),
        getDockerStatus()
      ]);

      // Update CSS custom properties for smooth animations
      updateProgressCircle(ramProgressRef.current, ram, '--ram-percentage');
      updateProgressCircle(storageProgressRef.current, storage, '--storage-percentage');
      updateProgressCircle(dockerProgressRef.current, docker, '--docker-percentage');
      
      // Update end wrapper rotations
      updateEndWrapper(ramEndWrapperRef.current, ram);
      updateEndWrapper(storageEndWrapperRef.current, storage);
      updateEndWrapper(dockerEndWrapperRef.current, docker);

      setRamUsage(ram);
      setStorageUsage(storage);
      setDockerStatus(docker);
    } catch (error) {
      console.error('Error fetching metrics:', error);
    }
  };

  // Update metrics on component mount and every 5 seconds
  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000);
    
    return () => clearInterval(interval);
  }, []);

  // Check if Docker status reaches 100% to trigger GalOS started animation
  useEffect(() => {
    if (dockerStatus >= 100) {
      setStartGalos(1);
    }
  }, [dockerStatus]);

  return (
    <div className="console-container">
      <div className="console-header">
        <div className = "ram-title">
          RAM Usage
        </div>
        <div className = "storage-title">
          Local Storage
        </div>
        <div className = "docker-title">
          GalOS Status
        </div>
      </div>
      <div className="console-body">

        <div className = "ram-status-container">
          <div className = "ram-status-dial">
            <div className = "dial-container">
              <div className = "dial-background" style = {{background: " #8B0000"}}>
              </div>
              <div 
                ref={ramProgressRef}
                className="progress-circle ram-progress-circle"
                style={{'transform': 'rotate(-45deg)'} as React.CSSProperties}
              />
              <div className = "cover-circle" style = {{background: "RGB(8,8,8)", zIndex: 4, width: "80%", height: "80%", position: "absolute", borderRadius: "50%"}}>
                                  <div className = "dial-text">
                    <div className = "usage-text" style = {{fontSize: "2vw", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", justifyContent: "center"}}>
                      <div><AnimatedNumber value={parseFloat((totalRam * ramUsage / 100).toFixed(1))} duration={500} decimals={1} /> GB</div>
                      <div style = {{fontSize: "1.5vw"}}><AnimatedNumber value={ramUsage} duration={500} />%</div>
                    </div>
                  </div>
              </div>
              <div className = "dial-start-point" style = {{background: "#8B0000"}}></div>
              <div ref={ramEndWrapperRef} className = "dial-end-wrapper">
                <div 
                  className = "dial-end-point" style={{background: "#8B0000"}}
                ></div>
              </div>
            </div>
          </div>
        </div>

        <div className = "storage-status-container">
          <div className = "docker-status-dial">
            <div className = "dial-container">
              <div className = "dial-background" style = {{background: "#FF8C00"}}>
              </div>
              <div 
                ref={storageProgressRef}
                className="progress-circle storage-progress-circle"
                style={{'transform': 'rotate(-45deg)'} as React.CSSProperties}
              />
              <div className = "cover-circle" style = {{background: "RGB(8,8,8)", zIndex: 4, width: "80%", height: "80%", position: "absolute", borderRadius: "50%"}}>
                              <div className = "dial-text">
                    <div className = "usage-text" style = {{fontSize: "2vw", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", justifyContent: "center"}}>
                      <div>{(totalStorage * storageUsage / 100).toFixed(1)} GB</div>
                      <div style = {{fontSize: "1.5vw"}}>{storageUsage}%</div>
                    </div>
                  </div>
              </div>
              <div className = "dial-start-point" style = {{background: "#FF8C00"}}></div>
              <div ref={storageEndWrapperRef} className = "dial-end-wrapper">
                <div 
                  className = "dial-end-point" style={{background: "#FF8C00"}}
                ></div>
              </div>
            </div>
          </div>
        </div>

        <div className = "docker-status-container">
          <div className = "docker-status-dial">
            <div className = "dial-container">
              <div className = "dial-background" style = {{background: " #006400"}}>
              </div>
              <div 
                ref={dockerProgressRef}
                className="progress-circle docker-progress-circle"
                style={{'transform': 'rotate(-45deg)'} as React.CSSProperties}
              />
              <div className = "cover-circle" style = {{background: "RGB(8,8,8)", zIndex: 4, width: "80%", height: "80%", position: "absolute", borderRadius: "50%"}}>
                                  <div className = "dial-text">
                    <div className = "usage-text" style = {{fontSize: "2vw", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", justifyContent: "center"}}>
                      {startGalos === 1 ? 
                        <div className="galos-started">
                          <div className="galos-text">GalOS Started</div>
                          <div className="galos-pulse"></div>
                        </div>
                       : 
                        (<>
                        <div><AnimatedNumber value={dockerImages} duration={500} /> Containers</div>
                        <div style = {{fontSize: "1.5vw"}}><AnimatedNumber value={dockerStatus} duration={500} />%</div>
                      </>)}
                      
                    </div>
                  </div>
              </div>
              <div className = "dial-start-point" style = {{background: "#006400"}}></div>
              <div ref={dockerEndWrapperRef} className = "dial-end-wrapper">
                <div 
                  className = "dial-end-point" style={{background: "#006400"}}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Console; 