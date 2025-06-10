import React from 'react';

interface InfoBoxProps {
  title: string;
  value: string | number;
  style?: React.CSSProperties;
}

const InfoBox: React.FC<InfoBoxProps> = ({ title, value, style }) => {
  return (
    <div className='info-box-border' style = {style}>
      <div className="info-box" style={style}>
        <div className="info-title">{title}</div>
      </div>
    </div>
  );
};

export default InfoBox; 