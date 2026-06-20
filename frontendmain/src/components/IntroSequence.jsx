import React, { useState, useEffect } from 'react';
import TiltedCarousel from './TiltedCarousel';

export default function IntroSequence({ onComplete }) {
  const [showCarousel, setShowCarousel] = useState(false);

  useEffect(() => {
    // The circle zoom takes 1.5s
    const timer = setTimeout(() => {
      setShowCarousel(true);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="intro-container">
      {!showCarousel && <div className="zoom-circle-fx" />}
      {showCarousel && <TiltedCarousel onComplete={onComplete} />}
    </div>
  );
}
