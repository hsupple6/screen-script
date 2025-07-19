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
    const loadImages = async () => {
      try {
        // Try to fetch the list of images from the backend or use a predefined list
        // Since we can't easily scan the folder from frontend, we'll use a backend endpoint
        const response = await fetch('/api/images');
        if (response.ok) {
          const imageList = await response.json();
          setImages(imageList);
        } else {
          throw new Error('Failed to fetch images');
        }
      } catch (error) {
        console.error('Error loading images:', error);
        // Fallback: try to load from a known set of images
        const fallbackImages = [
          { src: '/png/GalLogo.png', name: 'GalLogo' },
          { src: '/png/image1.png', name: 'image1' },
          { src: '/png/image2.png', name: 'image2' },
          { src: '/png/image3.png', name: 'image3' }
        ];
        setImages(fallbackImages);
      }
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