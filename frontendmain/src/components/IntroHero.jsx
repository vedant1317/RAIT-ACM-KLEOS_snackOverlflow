import React, { useState, useEffect } from 'react';
import './IntroHero.css';

export default function IntroHero({ onComplete }) {
  const [stage, setStage] = useState('initial'); // 'initial', 'zooming', 'hero'

  useEffect(() => {
    // Start zoom after a short delay
    const t1 = setTimeout(() => {
      setStage('zooming');
    }, 1000);

    // Show hero after zoom finishes
    const t2 = setTimeout(() => {
      setStage('hero');
    }, 2500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <div className={`intro-container stage-${stage}`}>
      {/* Background that will be revealed */}
      <div className="intro-bg" />

      {/* The expanding circle */}
      <div className="intro-circle">
        <span className="intro-circle-text">MUNSHI</span>
      </div>

      {/* The final hero content */}
      <div className="intro-hero-content">
        <h1 className="intro-huge-text">MUNSHI</h1>
        
        <div className="intro-cards-container">
          {/* Card 1 */}
          <div className="intro-card card-left" onClick={() => onComplete('client')}>
            <div className="intro-card-header">
              <h2>Vendor</h2>
              <p>Partner</p>
            </div>
            <div className="intro-card-body">
              <div className="intro-card-img placeholder-1"></div>
            </div>
            <div className="intro-card-footer">
              <button>Proceed</button>
            </div>
          </div>

          {/* Card 2 */}
          <div className="intro-card card-center" onClick={() => onComplete('admin')}>
            <div className="intro-card-header">
              <h2>CA Firms</h2>
              <p>Management</p>
            </div>
            <div className="intro-card-body">
              <div className="intro-card-img placeholder-2"></div>
            </div>
            <div className="intro-card-footer">
              <button>Proceed</button>
            </div>
          </div>

          {/* Card 3 */}
          <div className="intro-card card-right" onClick={() => onComplete('client')}>
            <div className="intro-card-header">
              <h2>Analytics</h2>
              <p>Overview</p>
            </div>
            <div className="intro-card-body">
              <div className="intro-card-img placeholder-3"></div>
            </div>
            <div className="intro-card-footer">
              <button>Proceed</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
