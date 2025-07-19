import React, { useState, useEffect } from 'react';
import './Pictures.css';

const Pictures: React.FC = () => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  const images = [
    'GalLogo',
    '2160x3840-dk9asom1hkjqfnwk',
    '2160x3840-forest-in-autumn-nhyxreotejswb75a',
    '840261-wallpaper',
    'debe8c043f66151e8fbb61d64d5bb669',
    'night_city_street_city_lights_134353_2160x3840',
    'wp4469784',
    'image1',
    'image2',
    'image3'
  ];

  // Image cycling effect
  useEffect(() => {
    if (images.length === 0) return;

    const interval = setInterval(() => {
      setCurrentImageIndex((prevIndex) => 
        prevIndex === images.length - 1 ? 0 : prevIndex + 1
      );
    }, 3000); // Change image every 3 seconds

    return () => clearInterval(interval);
  }, [images.length]);

  return (
    <div className="pictures-container">
      {images.map((image, index) => (
        <img
          key={image}
          src={image}
          alt={`Slide ${index + 1}`}
          className={`picture-slide ${index === currentImageIndex ? 'active' : ''}`}
        />
      ))}
    </div>
  );
};

export default Pictures; 