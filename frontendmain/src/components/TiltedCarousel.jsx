import React, { useEffect } from 'react';

const cards = [
  { id: 1, name: 'Vendor Portal', role: 'Manage Suppliers', image: 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&fit=crop&q=80&w=400' },
  { id: 2, name: 'CA Firms', role: 'Reconciliation & ITC', image: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&q=80&w=400' },
  { id: 3, name: 'Smart Invoicing', role: 'Automated Billing', image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=400' },
  { id: 4, name: 'Tax Compliance', role: 'GSTR-2B Matching', image: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&q=80&w=400' },
  { id: 5, name: 'Analytics', role: 'Financial Insights', image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=400' },
  { id: 6, name: 'Audit Trail', role: 'Secure Records', image: 'https://images.unsplash.com/photo-1618044733300-9472054094ee?auto=format&fit=crop&q=80&w=400' },
];

export default function TiltedCarousel({ onComplete }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      if(onComplete) onComplete();
    }, 2200); // Wait for swirl to finish completely
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="carousel-wrapper" onClick={onComplete} style={{ cursor: 'pointer' }}>
      <div className="carousel">
        {cards.map((card, index) => (
          <div key={card.id} className="carousel-card" style={{ transform: `rotateY(${index * 60}deg) translateZ(280px)` }}>
            <div>
              <h3 className="card-title">{card.name}</h3>
              <div className="card-subtitle">{card.role}</div>
            </div>
            
            <img src={card.image} alt={card.name} className="card-image" />
            
            <div className="card-button-row">
              <button className="card-support-btn">Explore</button>
              <button className="card-wallet-btn">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12H3m18 0l-6-6m6 6l-6 6"/>
                </svg>
                Enter
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
