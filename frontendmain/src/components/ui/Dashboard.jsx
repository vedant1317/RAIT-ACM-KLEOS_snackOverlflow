import { useState, useEffect, useRef, useCallback } from 'react';
import Typewriter from '../Typewriter';

const PRODUCTS = ['HD Webcam', 'Studio Mic', 'Laptop Pro', 'USB Hub', 'Mechanical Keyboard', 'Monitor 4K', 'Wireless Mouse'];
const NAMES = ['Jack Miller', 'Henry Clark', 'Grace Lee', 'Ivy Rodriguez', 'Tom White', 'Sara Kim', 'Alex Chen', 'Priya Shah'];

/* ─── Invoice Manager Data ────────────────────────────────── */
const INVOICE_DATA = [
  { id: 'LT-201', supplier: 'Surat Mills',   status: 'Wrong details',  taxable: 50000, gst: 6000,  hsn: '6109', hsnWarn: true,  itc: 3500  },
  { id: 'LT-202', supplier: 'Cotton House',  status: 'Wrong details',  taxable: 30000, gst: 1500,  hsn: '6109', hsnWarn: false, itc: 150   },
  { id: 'LT-203', supplier: 'Dye Works',     status: 'Missing from 2B',taxable: 20000, gst: 3600,  hsn: '3923', hsnWarn: false, itc: 3600  },
  { id: 'LT-204', supplier: 'Thread & Co',   status: 'Wrong details',  taxable: 10000, gst: 1800,  hsn: '9999', hsnWarn: true,  itc: null  },
  { id: 'LT-205', supplier: 'Surat Mills',   status: 'Duplicate',      taxable: 50000, gst: 6000,  hsn: '6109', hsnWarn: false, itc: 6000  },
  { id: 'LT-206', supplier: 'Weave Corp',    status: 'Matched',        taxable: 45000, gst: 8100,  hsn: '5208', hsnWarn: false, itc: null  },
  { id: 'LT-207', supplier: 'Print House',   status: 'Missing in books',taxable:15000, gst: 2700,  hsn: '4911', hsnWarn: false, itc: 2700  },
];

const STATUS_FILTERS = ['All', 'Wrong details', 'Duplicates', 'Missing from 2B', 'Missing in books', 'Matched'];

const STATUS_STYLE = {
  'Wrong details':   { bg: 'rgba(234, 179, 8, 0.12)',  color: '#fef08a', dot: '#eab308' },
  'Missing from 2B': { bg: 'rgba(239, 68, 68, 0.12)',  color: '#fecaca', dot: '#ef4444' },
  'Duplicate':       { bg: 'rgba(239, 68, 68, 0.12)',  color: '#fecaca', dot: '#ef4444' },
  'Missing in books':{ bg: 'rgba(234, 179, 8, 0.12)',  color: '#fef08a', dot: '#eab308' },
  'Matched':         { bg: 'rgba(16, 185, 129, 0.12)', color: '#a7f3d0', dot: '#10b981' },
};


function randomSale() {
  const amount = parseFloat((Math.random() * 250 + 50).toFixed(2));
  return {
    amount,
    product: PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)],
    name: NAMES[Math.floor(Math.random() * NAMES.length)],
  };
}

function timeNow() {
  const d = new Date();
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map(n => String(n).padStart(2, '0')).join(':');
}

/* ─── SVG Line Chart ─────────────────────────────────────── */
function LineChart({ data, color, gradientId, yMin = 0, yMax = 300 }) {
  if (data.length < 2) return <div className="chart-loading">Collecting data…</div>;

  const W = 480, H = 210;
  const pL = 60, pR = 12, pT = 12, pB = 32;
  const iW = W - pL - pR;
  const iH = H - pT - pB;

  const px = (i) => pL + (i / (data.length - 1)) * iW;
  const py = (v) => pT + (1 - (v - yMin) / Math.max(yMax - yMin, 1)) * iH;

  const pts = data.map((v, i) => `${px(i)},${py(v)}`).join(' ');
  const areaPts = `${px(0)},${pT + iH} ${pts} ${px(data.length - 1)},${pT + iH}`;

  const ySteps = [0, 0.25, 0.5, 0.75, 1];
  const fmt = (v) => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v.toFixed(0)}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0.01" />
        </linearGradient>
      </defs>
      {ySteps.map((r, i) => {
        const val = yMin + r * (yMax - yMin);
        const y = py(val);
        return (
          <g key={i}>
            <line x1={pL} x2={pL + iW} y1={y} y2={y}
              stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="4 4" />
            <text x={pL - 6} y={y + 4} textAnchor="end" fontSize="9"
              fill="rgba(255,255,255,0.3)" fontFamily="system-ui">{fmt(val)}</text>
          </g>
        );
      })}
      <polygon points={areaPts} fill={`url(#${gradientId})`} />
      <polyline points={pts} fill="none" stroke={color}
        strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={px(data.length - 1)} cy={py(data[data.length - 1])} r="4" fill={color} />
      <circle cx={px(data.length - 1)} cy={py(data[data.length - 1])} r="8" fill={color} fillOpacity="0.18" />
    </svg>
  );
}

/* ─── Main Dashboard ─────────────────────────────────────── */
export default function Dashboard({ mode = 'client' }) {
  const isAdmin = mode === 'admin';
  const MAX = 42;
  const overlayRef = useRef(null);
  const [spotlightIdx, setSpotlightIdx] = useState(-1);
  const [showInvoicesPopup, setShowInvoicesPopup] = useState(false);
  const [showReconPopup, setShowReconPopup] = useState(false);
  const [showItcPopup, setShowItcPopup] = useState(false);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [hoveredReconCategory, setHoveredReconCategory] = useState(null);
  const [activeFilter, setActiveFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showUploadMenu, setShowUploadMenu] = useState(false);

  const [salesData, setSalesData]       = useState([]);
  const [revenueData, setRevenueData]   = useState([]);
  const [payments, setPayments]         = useState([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalTx, setTotalTx]           = useState(0);
  const [avgSale, setAvgSale]           = useState(0);

  const tick = useCallback(() => {
    const sale = randomSale();
    const t = timeNow();
    setSalesData(prev => { const n = [...prev, sale.amount]; return n.length > MAX ? n.slice(-MAX) : n; });
    setRevenueData(prev => { const last = prev.length > 0 ? prev[prev.length - 1] : 0; const n = [...prev, last + sale.amount]; return n.length > MAX ? n.slice(-MAX) : n; });
    setTotalRevenue(prev => prev + sale.amount);
    setTotalTx(prev => prev + 1);
    setPayments(prev => [{ ...sale, time: t }, ...prev].slice(0, 10));
  }, []);

  /* ── Seed data + live tick ── */
  useEffect(() => {
    let runningRevenue = 0;
    const seedSales = Array.from({ length: 20 }, () => parseFloat((Math.random() * 220 + 60).toFixed(2)));
    const seedRevenue = seedSales.map((v) => (runningRevenue += v, runningRevenue));
    setSalesData(seedSales);
    setRevenueData(seedRevenue);
    setTotalRevenue(runningRevenue);
    setTotalTx(seedSales.length);
    setAvgSale(runningRevenue / seedSales.length);
    setPayments(Array.from({ length: 6 }, () => ({ ...randomSale(), time: timeNow() })));
    const interval = setInterval(tick, 2200);
    return () => clearInterval(interval);
  }, [tick]);

  useEffect(() => {
    if (totalTx > 0) setAvgSale(totalRevenue / totalTx);
  }, [totalRevenue, totalTx]);

  /* ── Spotlight sequence: runs once after drop-in completes ── */
  useEffect(() => {
    const START   = 1400;   
    const ON      = 750;    
    const GAP     = 180;    
    const STEP    = ON + GAP; 

    const timers = [];

    for (let i = 0; i < 6; i++) {
      timers.push(setTimeout(() => setSpotlightIdx(i),  START + i * STEP));
      timers.push(setTimeout(() => setSpotlightIdx(-1), START + i * STEP + ON));
    }

    const scrollAt = START + 5 * STEP + ON + 400;
    timers.push(setTimeout(() => {
      if (overlayRef.current) {
        overlayRef.current.scrollTo({ top: overlayRef.current.scrollHeight, behavior: 'smooth' });
      }
    }, scrollAt));

    return () => timers.forEach(clearTimeout);
  }, []); 

  const revMax = revenueData.length > 0 ? Math.max(...revenueData, 1) * 1.15 : 1000;

  const sl = (idx) => spotlightIdx === idx ? 'db-card-spotlight' : '';

  const filteredInvoices = INVOICE_DATA.filter(item => {
    const matchesSearch = item.supplier.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.hsn.includes(searchTerm);
    if (activeFilter === 'All') return matchesSearch;
    if (activeFilter === 'Duplicates') return item.status === 'Duplicate' && matchesSearch;
    return item.status === activeFilter && matchesSearch;
  });

  const itcInvoices = [...INVOICE_DATA].sort((a, b) => b.gst - a.gst);

  const reconCategories = [
    { label: 'Matched', color: '#6fb270', count: INVOICE_DATA.filter(i => i.status === 'Matched').length },
    { label: 'Wrong details', color: '#c89d3c', count: INVOICE_DATA.filter(i => i.status === 'Wrong details').length },
    { label: 'Duplicates', color: '#d75c50', count: INVOICE_DATA.filter(i => i.status === 'Duplicate').length },
    { label: 'Missing from 2B', color: '#f18f78', count: INVOICE_DATA.filter(i => i.status === 'Missing from 2B').length },
    { label: 'Missing in books', color: '#90a4ce', count: INVOICE_DATA.filter(i => i.status === 'Missing in books').length },
  ];
  const totalRecon = reconCategories.reduce((acc, cat) => acc + cat.count, 0);

  const mockCommitments = [
    { time: '08:02:45 PM', supplier: 'Surat Mills', gstValue: '₹6,000', daysLeft: 14 },
    { time: '08:02:42 PM', supplier: 'Cotton House', gstValue: '₹1,500', daysLeft: 7 },
    { time: '08:02:38 PM', supplier: 'Dye Works', gstValue: '₹3,600', daysLeft: 3 },
    { time: '08:02:32 PM', supplier: 'Thread & Co', gstValue: '₹1,800', daysLeft: -1 },
    { time: '08:02:30 PM', supplier: 'Weave Co', gstValue: '₹9,000', daysLeft: -3 }
  ].sort((a, b) => a.daysLeft - b.daysLeft); // Ascending order


  return (
    <div className="dashboard-overlay" ref={overlayRef}>

      {/* ── Dashboard Navbar ── */}
      <nav className="db-navbar">
        <span className="db-navbar-brand zigzag-text">
          <span className="zigzag-up">M</span>
          <span className="zigzag-down">U</span>
          <span className="zigzag-up">N</span>
          <span className="zigzag-down">S</span>
          <span className="zigzag-up">H</span>
          <span className="zigzag-down">I</span>
        </span>
        <div className="db-navbar-right">
          <div className="db-nav-pill">
            <button className="nav-pill-btn" onClick={() => window.location.href = '/'} title="Home">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9 22 9 12 15 12 15 22"></polyline>
              </svg>
            </button>
            
            <div className="notif-bell-wrapper">
              <button className="notif-bell-btn" onClick={() => setShowNotifDropdown(!showNotifDropdown)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {mockCommitments.filter(c => c.daysLeft < 2).length > 0 && (
                  <span className="notif-badge-count">{mockCommitments.filter(c => c.daysLeft < 2).length}</span>
                )}
              </button>
              {showNotifDropdown && (
                <div className="notif-dropdown">
                  <div className="notif-dropdown-arrow" />
                  {mockCommitments.filter(c => c.daysLeft < 2).map((c, i) => (
                    <div key={i} className="notif-dropdown-item">
                      <svg className="notif-item-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                      <div className="notif-item-content">
                        <div className="notif-item-title">{c.supplier} — {c.gstValue}</div>
                        <div className="notif-item-sub">{c.daysLeft} Days remaining</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="nav-pill-divider" />

            <button className="nav-pill-btn" title="Settings">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
            </button>

            <button className="nav-pill-btn" onClick={() => window.location.href = '/'} title="FAQ">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
            </button>

            <button className="nav-pill-btn" title="Security">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              </svg>
            </button>
          </div>
          <div className="db-navbar-profile">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4"/>
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
            </svg>
          </div>
        </div>
      </nav>

      {/* ── Ticker ── */}
      <div className="db-ticker">
        <div className="db-ticker-track">
          <div className="db-ticker-content">
            <span className="ticker-item">GST @ 18%: ₹12,450</span>
            <span className="ticker-item">GST @ 12%: ₹4,200</span>
            <span className="ticker-item">GST @ 5%: ₹8,900</span>
            <span className="ticker-item">Total ITC: ₹25,550</span>
            <span className="ticker-item">TDS @ 2%: ₹1,100</span>
            <span className="ticker-item">GST @ 18%: ₹12,450</span>
            <span className="ticker-item">GST @ 12%: ₹4,200</span>
            <span className="ticker-item">GST @ 5%: ₹8,900</span>
            <span className="ticker-item">Total ITC: ₹25,550</span>
            <span className="ticker-item">TDS @ 2%: ₹1,100</span>
          </div>
          <div className="db-ticker-content">
            <span className="ticker-item">GST @ 18%: ₹12,450</span>
            <span className="ticker-item">GST @ 12%: ₹4,200</span>
            <span className="ticker-item">GST @ 5%: ₹8,900</span>
            <span className="ticker-item">Total ITC: ₹25,550</span>
            <span className="ticker-item">TDS @ 2%: ₹1,100</span>
            <span className="ticker-item">GST @ 18%: ₹12,450</span>
            <span className="ticker-item">GST @ 12%: ₹4,200</span>
            <span className="ticker-item">GST @ 5%: ₹8,900</span>
            <span className="ticker-item">Total ITC: ₹25,550</span>
            <span className="ticker-item">TDS @ 2%: ₹1,100</span>
          </div>
        </div>
      </div>

      <div className="dashboard-scroll">

        {/* ── Stat Cards ── */}
        <div className="db-stats-row">
          {[
            {
              label: isAdmin ? 'Total Invoices' : 'Invoices',
              icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              ),
              value: <span className="db-green">{totalRevenue.toLocaleString()}</span>,
              desc: 'Cumulative invoices generated',
              clickable: true,
            },
            {
              label: isAdmin ? 'Issue Mix' : 'Open Issues', icon: '↻',
              value: <span>{totalTx}.00</span>,
              desc: 'Number of open issues recorded',
              clickable: true,
              onClick: () => setShowReconPopup(true),
            },
            {
              label: isAdmin ? 'ITC Exposure per Client' : 'Total ITC Risks',
              icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                </svg>
              ),
              value: <span className="db-blue">₹{avgSale.toFixed(2)}</span>,
              desc: 'Total input tax credit at risk',
              clickable: true,
              onClick: () => setShowItcPopup(true),
            },
            {
              label: isAdmin ? 'Priority Clients' : 'HSN Issues', icon: '◷',
              value: <span>{totalTx}</span>,
              desc: 'HSN code discrepancies detected',
            },
          ].map((card, i) => (
            <div 
              key={i} 
              className={`db-stat-card ${sl(i)} ${card.clickable ? 'clickable-stat-card' : ''}`}
              onClick={card.onClick ? card.onClick : (card.clickable ? () => setShowInvoicesPopup(true) : undefined)}
              style={card.clickable ? { cursor: 'pointer' } : undefined}
            >
              <div className="db-stat-header">
                <span className="db-stat-label">{card.label}</span>
                <span className="db-stat-icon">{card.icon}</span>
              </div>
              <div className="db-stat-value">{card.value}</div>
              <div className="db-stat-desc">{card.desc}</div>
            </div>
          ))}
        </div>

        {/* ── Charts Row ── */}
        <div className="db-charts-row">
          <div className={`db-chart-card ${sl(4)}`}>
            <div className="db-chart-header">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
                stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
                <line x1="6" y1="20" x2="6" y2="14"/>
              </svg>
              <h2 className="db-chart-title">{isAdmin ? 'ITC Exposure per Client' : 'ITC Lost per Sales'}</h2>
            </div>
            <div className="db-chart-area">
              <LineChart data={salesData} color="#10b981" gradientId="salesGrad" yMin={0} yMax={300} />
            </div>
            <div className="db-chart-legend" style={{ color: '#10b981' }}>⟿ ITC Lost</div>
          </div>

          <div className={`db-chart-card ${sl(5)}`}>
            <div className="db-chart-header">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
                stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
                <line x1="6" y1="20" x2="6" y2="14"/>
              </svg>
              <h2 className="db-chart-title">{isAdmin ? 'Issue Mix' : 'GSTR 2B v/s Invoice Manager'}</h2>
            </div>
            <div className="db-chart-area">
              <LineChart data={revenueData} color="#10b981" gradientId="revGrad" yMin={0} yMax={revMax} />
            </div>
            <div className="db-chart-legend" style={{ color: '#10b981' }}>⟿ GSTR 2B</div>
          </div>
        </div>

        {/* ── Logs-Style Commitments ── */}
        <div className={`db-payments-card logs-card ${sl(5)}`} style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="logs-header">
            <h2 className="logs-title">{isAdmin ? 'Priority Clients' : 'Commitments'}</h2>
            <p className="logs-sub">{mockCommitments.length} of {mockCommitments.length} commitments</p>
            <div className="logs-search-wrapper">
              <div className="logs-search-input-box">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input type="text" placeholder="Search commitments by message or supplier..." />
              </div>
              <button className="logs-filter-btn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                </svg>
              </button>
            </div>
          </div>
          <div className="db-payments-list logs-list">
            {mockCommitments.map((c, i) => (
              <div key={i} className="logs-row">
                <div className="logs-supplier">{c.supplier}</div>
                <div className="logs-desc">{c.gstValue}</div>
                <div className="logs-days" style={{ color: c.daysLeft >= 0 ? '#10b981' : '#ef4444' }}>
                  {c.daysLeft} Days
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Invoice Manager Slide-up Panel ── */}
      <div className={`invoice-manager-popup ${showInvoicesPopup ? 'is-open' : ''}`}>
        <div className="im-header">
          <h2 className="im-title">
            {showInvoicesPopup && <Typewriter text="Invoice Manager" speed={60} />}
          </h2>
          <button className="im-close-btn" onClick={() => setShowInvoicesPopup(false)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" 
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="im-toolbar">
          <div className="im-filters">
            {STATUS_FILTERS.map(f => (
              <button 
                key={f} 
                className={`im-filter-tab ${activeFilter === f ? 'is-active' : ''}`}
                onClick={() => setActiveFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="im-search-wrapper">
            <svg className="im-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input 
              type="text" 
              className="im-search-input" 
              placeholder="Search by ID, supplier, HSN..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Header summary info */}
        <div className="im-summary-header">
          <span className="im-summary-dot" />
          <span className="im-summary-title">Active Invoices</span>
          <span className="im-summary-count">{filteredInvoices.length} Invoices</span>
        </div>

        <div className="im-table-container custom-list-view">
          <div className="im-list-header">
            <span className="col-id">INVOICE ID</span>
            <span className="col-supplier">SUPPLIER</span>
            <span className="col-taxable">TAXABLE VALUE</span>
            <span className="col-gst">GST RATE/AMOUNT</span>
            <span className="col-hsn">HSN CODE</span>
            <span className="col-itc">ITC RISK</span>
            <span className="col-status">STATUS</span>
          </div>

          <div className="im-list-body">
            {filteredInvoices.length > 0 ? (
              filteredInvoices.map((inv, idx) => {
                const formattedIdx = String(idx + 1).padStart(2, '0');
                
                // Determine supplier logo icon details
                const isSurat = inv.supplier.includes('Surat');
                const isCotton = inv.supplier.includes('Cotton');
                const isDye = inv.supplier.includes('Dye');
                const isThread = inv.supplier.includes('Thread');
                const isWeave = inv.supplier.includes('Weave');
                
                let logoBg = 'rgba(59, 130, 246, 0.15)';
                let logoColor = '#60a5fa';
                let logoChar = 'S';
                if (isSurat) { logoBg = 'rgba(59, 130, 246, 0.15)'; logoColor = '#60a5fa'; logoChar = 'S'; }
                else if (isCotton) { logoBg = 'rgba(16, 185, 129, 0.15)'; logoColor = '#34d399'; logoChar = 'C'; }
                else if (isDye) { logoBg = 'rgba(245, 158, 11, 0.15)'; logoColor = '#fbbf24'; logoChar = 'D'; }
                else if (isThread) { logoBg = 'rgba(239, 68, 68, 0.15)'; logoColor = '#f87171'; logoChar = 'T'; }
                else if (isWeave) { logoBg = 'rgba(139, 92, 246, 0.15)'; logoColor = '#a78bfa'; logoChar = 'W'; }
                
                let statusBadgeText = inv.status;
                let statusClass = 'status-active';
                if (inv.status === 'Matched') {
                  statusClass = 'status-active';
                } else if (inv.status === 'Wrong details' || inv.status === 'Missing from 2B' || inv.status === 'Missing in books') {
                  statusClass = 'status-paused';
                } else if (inv.status === 'Duplicate') {
                  statusClass = 'status-inactive';
                }

                // Vertical risk bars count (like CPU meter in image)
                const barCount = inv.status === 'Matched' ? 2 : inv.status === 'Wrong details' ? 5 : inv.status === 'Duplicate' ? 9 : 8;

                return (
                  <div key={inv.id} className="im-row-card">
                    
                    <div className="card-col-id clickable-id" onClick={() => setSelectedInvoice(inv)} style={{ cursor: 'pointer', textDecoration: 'underline' }}>
                      {inv.id}
                    </div>

                    <div className="card-col-supplier">
                      <div className="supplier-logo-wrap" style={{ backgroundColor: logoBg, color: logoColor }}>
                        {logoChar}
                      </div>
                      <div className="supplier-info">
                        <span className="supplier-name">{inv.supplier}</span>
                        <span className="supplier-sub">Vendor Partner</span>
                      </div>
                    </div>

                    <div className="card-col-taxable">
                      <span className="val-main">₹{inv.taxable.toLocaleString()}</span>
                      <span className="val-sub">INR</span>
                    </div>

                    <div className="card-col-gst">
                      <span className="val-main">₹{inv.gst.toLocaleString()}</span>
                      <span className="val-sub">{inv.gst === 6000 ? '12% GST' : inv.gst === 1500 ? '5% GST' : '18% GST'}</span>
                    </div>

                    <div className="card-col-hsn">
                      <span className={`hsn-pill ${inv.hsnWarn || inv.status === 'Wrong details' ? 'is-warn' : ''}`}>
                        {inv.hsn}
                        {(inv.hsnWarn || inv.status === 'Wrong details') && <span className="hsn-warn-dot">⚠</span>}
                      </span>
                    </div>

                    <div className="card-col-itc">
                      <div className="cpu-bar-container">
                        <div className="cpu-bars">
                          {Array.from({ length: 10 }).map((_, bIdx) => (
                            <span 
                              key={bIdx} 
                              className={`cpu-bar ${bIdx < barCount ? 'is-lit' : ''} ${statusClass}`}
                            />
                          ))}
                        </div>
                        <span className="cpu-percentage">{barCount * 10}%</span>
                      </div>
                    </div>

                    <div className="card-col-status">
                      <span className={`service-status-badge ${statusClass}`}>
                        {statusBadgeText}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="im-empty-card">No invoices found matching criteria.</div>
            )}
          </div>
        </div>

        <div className="im-action-buttons">
          <button className="im-glass-btn" onClick={() => setShowUploadMenu(!showUploadMenu)}>Import</button>
          <button className="im-glass-btn" onClick={() => setShowUploadMenu(!showUploadMenu)}>Upload GSTR-2B</button>
          
          {showUploadMenu && (
            <div className="upload-popup-menu">
              <div className="upload-menu-item">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                <span>Add files or photos</span>
                <span className="upload-shortcut">⌘U</span>
              </div>
              <div className="upload-menu-item">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                <span>Take a screenshot</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Policy Modal Overlay ── */}
      {selectedInvoice && (
        <div className="policy-modal-overlay" onClick={() => setSelectedInvoice(null)}>
          <div className="policy-card comparison-card" onClick={(e) => e.stopPropagation()}>
            
            {/* Top row with supplier initials avatar, expiration */}
            <div className="pc-top-row">
              <div className="pc-avatar-wrap">
                <div className="pc-avatar">
                  {selectedInvoice.supplier.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()}
                </div>
                <div className="pc-meta">
                  <span className="pc-badge-expire">Expires in -171 days</span>
                  <span className="pc-date-subtitle">Dec 31, 2025</span>
                </div>
              </div>
            </div>

            <div className="comp-title">BOOKS VS GSTR-2B</div>
            
            <table className="comp-table">
              <thead>
                <tr>
                  <th align="left">Field</th>
                  <th align="left">In books</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="comp-field-label">Vendor name</td>
                  <td className="comp-val-books">{selectedInvoice.supplier}</td>
                </tr>
                <tr>
                  <td className="comp-field-label">Taxable value</td>
                  <td className="comp-val-books">₹{selectedInvoice.taxable.toLocaleString()}</td>
                </tr>
                <tr>
                  <td className="comp-field-label">GST rate</td>
                  <td className="comp-val-books">{selectedInvoice.gst === 6000 ? '12%' : selectedInvoice.gst === 1500 ? '5%' : selectedInvoice.gst === 3600 ? '18%' : selectedInvoice.gst === 1800 ? '18%' : selectedInvoice.gst === 8100 ? '18%' : selectedInvoice.gst === 2700 ? '18%' : '—'}</td>
                </tr>
                <tr>
                  <td className="comp-field-label">GST amount</td>
                  <td className="comp-val-books">₹{selectedInvoice.gst.toLocaleString()}</td>
                </tr>
                <tr>
                  <td className="comp-field-label">HSN code</td>
                  <td className="comp-val-books">{selectedInvoice.hsn}</td>
                </tr>
                <tr>
                  <td className="comp-field-label">Invoice date</td>
                  <td className="comp-val-books">2026-05-14</td>
                </tr>
              </tbody>
            </table>

            {/* Corrected Measure button */}
            <button className="pc-update-btn" onClick={() => setSelectedInvoice(null)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '6px' }}>
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              Corrected Measure
            </button>

          </div>
        </div>
      )}

      {/* ── Reconciliation Popup ── */}
      <div className={`recon-popup ${showReconPopup ? 'is-open' : ''}`}>
        <div className="im-header" style={{ marginBottom: 24, padding: 0 }}>
          <div className="recon-popup-header" style={{ margin: 0, textAlign: 'left' }}>
            <h2 className="recon-popup-title">
              {showReconPopup && <Typewriter text="Reconciliation breakdown" speed={60} />}
            </h2>
            <p className="recon-popup-subtitle">How this client's invoices map against GSTR-2B.</p>
          </div>
          <button className="im-close-btn" onClick={() => setShowReconPopup(false)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" 
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="recon-bar-container">
          {reconCategories.map(cat => {
            const widthPct = totalRecon > 0 ? (cat.count / totalRecon) * 100 : 0;
            if (widthPct === 0) return null;
            return (
              <div 
                key={cat.label} 
                className="recon-bar-segment" 
                style={{ width: `${widthPct}%`, backgroundColor: cat.color }}
                onMouseEnter={() => setHoveredReconCategory(cat.label)}
                onMouseLeave={() => setHoveredReconCategory(null)}
              />
            );
          })}
        </div>

        <div className="recon-legend">
          {reconCategories.map(cat => (
            <div 
              key={cat.label} 
              className="recon-legend-item"
            >
              <div className="recon-legend-item-left">
                <div className="recon-legend-dot" style={{ backgroundColor: cat.color }} />
                <span>{cat.label}</span>
              </div>
              <span className="recon-legend-count">{cat.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── ITC Risk Popup ── */}
      <div className={`invoice-manager-popup ${showItcPopup ? 'is-open' : ''}`}>
        <div className="im-header">
          <h2 className="im-title">
            {showItcPopup && <Typewriter text="Total ITC Risks" speed={60} />}
          </h2>
          <button className="im-close-btn" onClick={() => setShowItcPopup(false)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" 
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="im-table-container custom-list-view" style={{ marginTop: '20px' }}>
          <div className="itc-list-header">
            <span className="col-id">INVOICE ID</span>
            <span className="col-supplier">SUPPLIER</span>
            <span className="col-taxable">TAXABLE VALUE</span>
            <span className="col-gst">GST RATE/AMOUNT</span>
            <span className="col-hsn">HSN CODE</span>
          </div>

          <div className="im-list-body">
            {itcInvoices.length > 0 ? (
              itcInvoices.map((inv) => {
                const isSurat = inv.supplier.includes('Surat');
                const isCotton = inv.supplier.includes('Cotton');
                const isDye = inv.supplier.includes('Dye');
                const isThread = inv.supplier.includes('Thread');
                const isWeave = inv.supplier.includes('Weave');
                
                let logoBg = 'rgba(59, 130, 246, 0.15)';
                let logoColor = '#60a5fa';
                let logoChar = 'S';
                if (isSurat) { logoBg = 'rgba(59, 130, 246, 0.15)'; logoColor = '#60a5fa'; logoChar = 'S'; }
                else if (isCotton) { logoBg = 'rgba(16, 185, 129, 0.15)'; logoColor = '#34d399'; logoChar = 'C'; }
                else if (isDye) { logoBg = 'rgba(245, 158, 11, 0.15)'; logoColor = '#fbbf24'; logoChar = 'D'; }
                else if (isThread) { logoBg = 'rgba(239, 68, 68, 0.15)'; logoColor = '#f87171'; logoChar = 'T'; }
                else if (isWeave) { logoBg = 'rgba(139, 92, 246, 0.15)'; logoColor = '#a78bfa'; logoChar = 'W'; }
                
                return (
                  <div key={inv.id} className="itc-row-card">
                    <div className="card-col-id clickable-id" onClick={() => setSelectedInvoice(inv)} style={{ cursor: 'pointer', textDecoration: 'underline' }}>
                      {inv.id}
                    </div>

                    <div className="card-col-supplier">
                      <div className="supplier-logo-wrap" style={{ backgroundColor: logoBg, color: logoColor }}>
                        {logoChar}
                      </div>
                      <div className="supplier-info">
                        <span className="supplier-name">{inv.supplier}</span>
                        <span className="supplier-sub">Vendor Partner</span>
                      </div>
                    </div>

                    <div className="card-col-taxable">
                      <span className="val-main">₹{inv.taxable.toLocaleString()}</span>
                      <span className="val-sub">INR</span>
                    </div>

                    <div className="card-col-gst">
                      <span className="val-main">₹{inv.gst.toLocaleString()}</span>
                      <span className="val-sub">{inv.gst === 6000 ? '12% GST' : inv.gst === 1500 ? '5% GST' : '18% GST'}</span>
                    </div>

                    <div className="card-col-hsn">
                      <span className={`hsn-pill ${inv.hsnWarn || inv.status === 'Wrong details' ? 'is-warn' : ''}`}>
                        {inv.hsn}
                        {(inv.hsnWarn || inv.status === 'Wrong details') && <span className="hsn-warn-dot">⚠</span>}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="im-empty-card">No invoices found.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
