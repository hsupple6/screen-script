import React, { useState } from 'react';
import './Console.css';
import GalLogo from './png/GalLogo.png'

interface HomeProps {
  title?: string;
}

const Console: React.FC<HomeProps> = ({ title = 'Welcome to Screen Script' }) => {
  const [IP, setIP] = useState<string>('192.168.1.69');

  return (
    <div className="console-container">

    </div>
  );
};

export default Console; 