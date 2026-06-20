const fs = require('fs');

const data = fs.readFileSync('src/components/ui/Dashboard.jsx', 'utf8');

const newStyles = `
/* ─── Reconciliation Popup ─── */
.recon-popup {
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 65vh;
  background: #1e1e1e;
  border-top-left-radius: 24px;
  border-top-right-radius: 24px;
  box-shadow: 0 -10px 40px rgba(0,0,0,0.5);
  transform: translateY(100%);
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  z-index: 200;
  padding: 32px 40px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.recon-popup.is-open {
  transform: translateY(0);
}

.recon-popup-header {
  margin-bottom: 24px;
}

.recon-popup-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: #fff;
  margin: 0 0 6px 0;
}

.recon-popup-subtitle {
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.5);
  margin: 0;
}

.recon-bar-container {
  width: 100%;
  height: 12px;
  display: flex;
  border-radius: 6px;
  overflow: hidden;
  margin-bottom: 24px;
}

.recon-bar-segment {
  height: 100%;
  transition: opacity 0.2s;
  cursor: crosshair;
}
.recon-bar-segment:hover {
  opacity: 0.8;
}

.recon-legend {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  row-gap: 16px;
  column-gap: 40px;
}

.recon-legend-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.7);
  transition: opacity 0.2s;
}

.recon-legend-item-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.recon-legend-dot {
  width: 12px;
  height: 12px;
  border-radius: 3px;
}

.recon-legend-count {
  font-weight: 600;
  color: #fff;
}
`;

fs.appendFileSync('src/index.css', newStyles);

