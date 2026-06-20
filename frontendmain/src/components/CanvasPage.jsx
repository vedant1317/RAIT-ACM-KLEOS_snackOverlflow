import { useState } from 'react';
import VerticalBarsNoise from './ui/vertical-bars';
import HorizontalFlowBars from './ui/horizontal-bars';
import Dashboard from './ui/Dashboard';
import VendorRiskGraphPage from './VendorRiskGraphPage';

export default function CanvasPage({ canvasView = 'vertical', mode = 'client', identity, onLogout }) {
  const [page, setPage] = useState('dashboard'); // 'dashboard' | 'riskGraph'

  return (
    <div className="canvas-page">
      {/* Translucent animated background */}
      <div className="canvas-bg-layer">
        {canvasView === 'vertical' ? (
          <VerticalBarsNoise
            backgroundColor="#0d0f1a"
            lineColor="#1e2233"
            barColor="#3b4a6b"
            lineWidth={1}
            animationSpeed={0.0004}
            removeWaveLine={true}
          />
        ) : (
          <HorizontalFlowBars
            backgroundColor="#0d0f1a"
            lineColor="#1e2233"
            barColor="#3b4a6b"
            lineWidth={1}
            animationSpeed={0.0004}
            removeWaveLine={true}
          />
        )}
      </div>

      {/* Dark translucent overlay to dim the canvas */}
      <div className="canvas-dim-overlay" />

      {/* Page content */}
      {page === 'riskGraph' ? (
        <VendorRiskGraphPage onBack={() => setPage('dashboard')} />
      ) : (
        <Dashboard
          mode={mode}
          identity={identity}
          onLogout={onLogout}
          onOpenRiskGraph={mode === 'admin' ? () => setPage('riskGraph') : undefined}
        />
      )}
    </div>
  );
}
