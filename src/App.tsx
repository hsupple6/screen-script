import React, { useEffect } from 'react';
import './App.css';
import Home from './src/Home';
import Pictures from './Pictures';

function App() {
  const toggleFullScreen = async () => {
    try {
      if (!document.fullscreenElement) {
        // Try different vendor prefixes for fullscreen
        const element = document.documentElement;
        if (element.requestFullscreen) {
          await element.requestFullscreen();
        } else if ((element as any).webkitRequestFullscreen) {
          await (element as any).webkitRequestFullscreen();
        } else if ((element as any).mozRequestFullScreen) {
          await (element as any).mozRequestFullScreen();
        } else if ((element as any).msRequestFullscreen) {
          await (element as any).msRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        } else if ((document as any).mozCancelFullScreen) {
          await (document as any).mozCancelFullScreen();
        } else if ((document as any).msExitFullscreen) {
          await (document as any).msExitFullscreen();
        }
      }
    } catch (error) {
      console.error('Error toggling fullscreen:', error);
    }
  };

  useEffect(() => {
    // Add keyboard shortcut listener (F11 for fullscreen toggle)
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'F11') {
        e.preventDefault();
        toggleFullScreen();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  // Simple routing based on pathname
  const getCurrentRoute = () => {
    const path = window.location.pathname;
    if (path === '/pictures') {
      return 'pictures';
    }
    return 'home';
  };

  const currentRoute = getCurrentRoute();

  if (currentRoute === 'pictures') {
    return <Pictures />;
  }

  return (
    <div className="App">
      <div className = 'Spacer' style = {{width: "10%", height: "100%", background: "black", position: "relative", left: "0"}}></div>
      <Home/>
    </div>
  );
}

export default App;
