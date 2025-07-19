import React, { useState, useEffect } from 'react';
import './Pictures.css';

interface Image {
  src: string;
  name: string;
}

const Pictures: React.FC = () => {
  const [images, setImages] = useState<Image[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  // Load images from the png folder
  useEffect(() => {
    const loadImages = () => {
      // Since we can't dynamically scan the folder from frontend,
      // we'll use a predefined list of common image names
      // You can add more image names to this array
      const imageNames = [
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
      
      const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
      const imageList: Image[] = [];
      
      // Create image objects for each name and extension combination
      imageNames.forEach(name => {
        imageExtensions.forEach(ext => {
          imageList.push({
            src: `/png/${name}${ext}`,
            name: name
          });
        });
      });
      
      setImages(imageList);
    };

    loadImages();
  }, []);

  // Image cycling effect
  useEffect(() => {
    if (images.length === 0) return;

    const interval = setInterval(() => {
      // Fade out
      setIsVisible(false);
      
      setTimeout(() => {
        // Change image
        setCurrentImageIndex((prevIndex) => 
          prevIndex === images.length - 1 ? 0 : prevIndex + 1
        );
        
        // Fade in
        setIsVisible(true);
      }, 1000); // 1 second fade out time
    }, 5000); // Change image every 5 seconds

    return () => clearInterval(interval);
  }, [images.length]);

  if (images.length === 0) {
    return (
      <div className="pictures-container">
        <div className="loading-message">Loading images...</div>
      </div>
    );
  }

  const currentImage = images[currentImageIndex];

  return (
    <div className="pictures-container">
      <div 
        className={`image-display ${isVisible ? 'fade-in' : 'fade-out'}`}
        style={{
          backgroundImage: `url(${currentImage.src})`,
        }}
        onError={(e) => {
          // If image fails to load, skip to next one
          console.log(`Failed to load image: ${currentImage.src}`);
          setCurrentImageIndex((prevIndex) => 
            prevIndex === images.length - 1 ? 0 : prevIndex + 1
          );
        }}
      >
        <div className="image-info">
          <span className="image-name">{currentImage.name}</span>
          <span className="image-counter">
            {currentImageIndex + 1} / {images.length}
          </span>
        </div>
      </div>
    </div>
  );
};

export default Pictures; 