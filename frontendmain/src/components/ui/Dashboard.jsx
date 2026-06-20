import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Typewriter from '../Typewriter';
import { caApi, clientApi } from '../../api/client';

const STATUS_FILTERS = ['All', 'Wrong details', 'Duplicates', 'Missing from 2B', 'Missing in books', 'Matched'];

const STATUS_MAP = {
  matched: 'Matched',
  mismatch: 'Wrong details',
  review: 'Wrong details',
  duplicate: 'Duplicate',
  missing_in_2b: 'Missing from 2B',
  missing_in_books: 'Missing in books',
};

const RECON_COLORS = {
  Matched: '#6fb270',
  'Wrong details': '#c89d3c',
  Duplicate: '#d75c50',
  'Missing from 2B': '#f18f78',
  'Missing in books': '#90a4ce',
};

const LOGO_PALETTE = [
  { bg: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' },
  { bg: 'rgba(16, 185, 129, 0.15)', color: '#34d399' },
  { bg: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' },
  { bg: 'rgba(239, 68, 68, 0.15)', color: '#f87171' },
  { bg: 'rgba(139, 92, 246, 0.15)', color: '#a78bfa' },
  { bg: 'rgba(236, 72, 153, 0.15)', color: '#f472b6' },
];

function supplierLogo(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  const palette = LOGO_PALETTE[hash % LOGO_PALETTE.length];
  const char = (name.trim()[0] || '?').toUpperCase();
  return { ...palette, char };
}

function unwrapList(data) {
  if (!data) return [];
  return Array.isArray(data) ? data : data.items || [];
}

function inr(value) {
  const n = Number(value || 0);
  return n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
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
  const fmt = (v) => v >= 1000 ? `₹${(v / 1000).toFixed(0)}k` : `₹${v.toFixed(0)}`;

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

function mapRowToInvoiceLike(row) {
  const primary = row.book || row.gstr2b || {};
  return {
    id: row.invoice_number,
    supplier: row.vendor_name,
    status: STATUS_MAP[row.status] || row.status,
    rawStatus: row.status,
    taxable: primary.taxable_value || 0,
    gst: primary.gst_amount || 0,
    gstRate: primary.gst_rate,
    hsn: row.hsn_code || primary.hsn_code || '—',
    hsnWarn: (row.issues || []).some((i) => i.type === 'hsn_mismatch'),
    itc: row.rupee_impact || null,
    issues: row.issues || [],
    anomalies: row.anomalies || [],
    invoiceDate: primary.invoice_date || row.invoice_date,
    book: row.book,
    gstr2b: row.gstr2b,
    fieldDiffs: row.field_diffs || [],
    period: row.period,
  };
}

function fieldDiffers(diffs, field) {
  return diffs.some((d) => d.field === field);
}

/* ─── Main Dashboard ─────────────────────────────────────── */
export default function Dashboard({ mode = 'client', identity, onLogout, onOpenRiskGraph }) {
  const isAdmin = mode === 'admin';
  const overlayRef = useRef(null);
  const [spotlightIdx, setSpotlightIdx] = useState(-1);
  const [showInvoicesPopup, setShowInvoicesPopup] = useState(false);
  const [showReconPopup, setShowReconPopup] = useState(false);
  const [showItcPopup, setShowItcPopup] = useState(false);
  const [showAlertsPopup, setShowAlertsPopup] = useState(false);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [activeFilter, setActiveFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showUploadMenu, setShowUploadMenu] = useState(false);
  const [draftPreview, setDraftPreview] = useState(null);

  // ── Real data state ──
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [profile, setProfile] = useState(null);
  const [reconRows, setReconRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [historyRuns, setHistoryRuns] = useState([]);
  const [issues, setIssues] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [remindersDue, setRemindersDue] = useState([]);
  const [timelineDaysLeft, setTimelineDaysLeft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const invoiceFileRef = useRef(null);
  const baselineFileRef = useRef(null);

  const scopedApi = useMemo(() => {
    if (isAdmin) {
      const id = selectedClientId;
      return {
        getClient: () => caApi.getClient(id),
        getReconciliation: () => caApi.getReconciliation(id),
        getReconciliationHistory: () => caApi.getReconciliationHistory(id),
        runReconcile: () => caApi.runReconcile(id),
        listIssues: () => caApi.listIssues(id),
        setIssueStatus: (payload) => caApi.setIssueStatus(id, payload),
        draftMessage: (payload) => caApi.draftMessage(id, payload),
        getTimeline: () => caApi.getTimeline(id),
        uploadInvoices: (file) => caApi.uploadInvoices(id, file),
        uploadBaseline: (file) => caApi.uploadBaseline(id, file),
        downloadReport: () => caApi.downloadReport(id),
      };
    }
    return {
      getClient: () => clientApi.me(),
      getReconciliation: () => clientApi.getReconciliation(),
      getReconciliationHistory: () => clientApi.getReconciliationHistory(),
      runReconcile: () => clientApi.runReconcile(),
      listIssues: () => clientApi.listIssues(),
      setIssueStatus: (payload) => clientApi.setIssueStatus(payload),
      draftMessage: (payload) => clientApi.draftMessage(payload),
      getTimeline: () => clientApi.getTimeline(),
      uploadInvoices: (file) => clientApi.uploadInvoices(file),
      uploadBaseline: (file) => clientApi.uploadBaseline(file),
      downloadReport: () => clientApi.downloadReport(),
    };
  }, [isAdmin, selectedClientId]);

  // ── Load the firm-wide client list once, for the admin selector ──
  useEffect(() => {
    if (!isAdmin) return;
    caApi.listClients().then((list) => {
      setClients(list);
      if (list.length > 0) setSelectedClientId((prev) => prev || list[0].id);
    }).catch((err) => setLoadError(err.message));
  }, [isAdmin]);

  const loadDashboard = useCallback(async () => {
    if (isAdmin && !selectedClientId) return;
    setLoading(true);
    setLoadError('');
    try {
      const [clientData, recon, history, issuesData] = await Promise.all([
        scopedApi.getClient(),
        scopedApi.getReconciliation(),
        scopedApi.getReconciliationHistory(),
        scopedApi.listIssues(),
      ]);
      setProfile(clientData);
      setSummary(clientData.summary || recon.summary);
      setReconRows(recon.rows || []);
      setHistoryRuns(Array.isArray(history) ? history : []);
      setIssues(unwrapList(issuesData));

      if (isAdmin) {
        caApi.listAlerts({ acked: false }).then((d) => setAlerts(unwrapList(d))).catch(() => {});
        caApi.remindersDue().then(setRemindersDue).catch(() => {});
      }

      try {
        const timeline = await scopedApi.getTimeline();
        const deadline = (timeline.events || []).find((e) => e.key === 'filing_deadline');
        setTimelineDaysLeft(deadline ? deadline.days_remaining : null);
      } catch {
        setTimelineDaysLeft(null);
      }
    } catch (err) {
      setLoadError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, selectedClientId, scopedApi]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  /* ── Spotlight sequence: runs once after drop-in completes ── */
  useEffect(() => {
    const START = 1400, ON = 750, GAP = 180, STEP = ON + GAP;
    const timers = [];
    for (let i = 0; i < 6; i++) {
      timers.push(setTimeout(() => setSpotlightIdx(i), START + i * STEP));
      timers.push(setTimeout(() => setSpotlightIdx(-1), START + i * STEP + ON));
    }
    return () => timers.forEach(clearTimeout);
  }, []);

  const sl = (idx) => spotlightIdx === idx ? 'db-card-spotlight' : '';

  const invoiceRows = useMemo(
    () => reconRows.map(mapRowToInvoiceLike).sort((a, b) => (b.itc || 0) - (a.itc || 0)),
    [reconRows]
  );

  const filteredInvoices = invoiceRows.filter((item) => {
    const matchesSearch =
      item.supplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.hsn || '').includes(searchTerm);
    if (activeFilter === 'All') return matchesSearch;
    if (activeFilter === 'Duplicates') return item.status === 'Duplicate' && matchesSearch;
    return item.status === activeFilter && matchesSearch;
  });

  const itcInvoices = [...invoiceRows].sort((a, b) => b.gst - a.gst);

  const reconCategories = STATUS_FILTERS.slice(1).map((label) => ({
    label,
    color: RECON_COLORS[label],
    count: invoiceRows.filter((i) => i.status === (label === 'Duplicates' ? 'Duplicate' : label)).length,
  }));
  const totalRecon = reconCategories.reduce((acc, cat) => acc + cat.count, 0);

  const openIssues = issues.filter((i) => i.status === 'open' || i.status === 'chasing');
  const commitments = [...openIssues]
    .sort((a, b) => b.rupee_impact - a.rupee_impact)
    .slice(0, 8)
    .map((issue) => ({
      supplier: issue.vendor_name,
      gstValue: `₹${inr(issue.rupee_impact)}`,
      daysLeft: timelineDaysLeft ?? 0,
      issue,
    }));

  // History runs come back newest-first; charts read left-to-right chronologically.
  const chronological = [...historyRuns].reverse();
  const itcTrend = chronological.map((r) => r.summary?.itc_at_risk || 0);
  const issuesTrend = chronological.map((r) => r.summary?.total_issues || 0);
  const itcTrendMax = Math.max(...itcTrend, 1000) * 1.15;
  const issuesTrendMax = Math.max(...issuesTrend, 5) * 1.3;

  const moneyUnlocked = issues.filter((i) => i.status === 'resolved').reduce((sum, i) => sum + (i.rupee_impact || 0), 0);
  const healthScore = summary?.health_score ?? 100;

  // Live ticker: real GST-rate buckets from this client's own invoices, not random data.
  const tickerBuckets = useMemo(() => {
    const byRate = {};
    for (const row of invoiceRows) {
      const rate = row.gstRate != null ? `${row.gstRate}%` : 'Unrated';
      byRate[rate] = (byRate[rate] || 0) + row.gst;
    }
    const entries = Object.entries(byRate).map(([rate, amount]) => `GST @ ${rate}: ₹${inr(amount)}`);
    entries.push(`Total ITC at risk: ₹${inr(summary?.itc_at_risk)}`);
    entries.push(`Health Score: ${healthScore}/100`);
    return entries.length > 0 ? entries : ['No invoices yet — send a bill on WhatsApp to see live numbers here.'];
  }, [invoiceRows, summary, healthScore]);

  async function handleFileSelected(kind, file) {
    if (!file) return;
    setShowUploadMenu(false);
    setStatusMsg(kind === 'invoices' ? 'Uploading invoices…' : 'Uploading GSTR-2B…');
    try {
      const result = kind === 'invoices'
        ? await scopedApi.uploadInvoices(file)
        : await scopedApi.uploadBaseline(file);
      setStatusMsg(
        kind === 'invoices'
          ? `Saved ${result.added ?? result.saved ?? 0} invoice(s).`
          : `Loaded ${result.rows_loaded ?? 0} GSTR-2B row(s) for ${result.period || 'this period'}.`
      );
      await loadDashboard();
    } catch (err) {
      setStatusMsg(`Upload failed: ${err.message}`);
    }
  }

  async function handleRunReconcile() {
    setStatusMsg('Running reconciliation…');
    try {
      await scopedApi.runReconcile();
      setStatusMsg('Reconciliation complete.');
      await loadDashboard();
    } catch (err) {
      setStatusMsg(`Reconciliation failed: ${err.message}`);
    }
  }

  async function handleIssueStatus(issueKey, status) {
    setStatusMsg(status === 'resolved' ? 'Marking as fixed…' : 'Marking as sent / following up…');
    try {
      await scopedApi.setIssueStatus({ issue_key: issueKey, status, note: '' });
      setStatusMsg(status === 'resolved' ? 'Issue marked fixed — ITC unlocked!' : 'Marked as sent — follow-up tracked.');
      await loadDashboard();
      setSelectedInvoice(null);
    } catch (err) {
      setStatusMsg(`Could not update issue: ${err.message}`);
    }
  }

  async function handleDraftMessage(issueKey) {
    setStatusMsg('Drafting supplier correction request…');
    try {
      const result = await scopedApi.draftMessage({ issue_key: issueKey, language: 'en' });
      setStatusMsg('');
      setDraftPreview(result.draft);
    } catch (err) {
      setStatusMsg(`Could not draft message: ${err.message}`);
    }
  }

  function renderInvoiceRow(inv, listClass) {
    const logo = supplierLogo(inv.supplier);
    const statusClass =
      inv.status === 'Matched' ? 'status-active' : inv.status === 'Duplicate' ? 'status-inactive' : 'status-paused';
    const barCount = inv.status === 'Matched' ? 2 : inv.status === 'Wrong details' ? 5 : inv.status === 'Duplicate' ? 9 : 8;

    return (
      <div key={inv.id} className={listClass}>
        <div className="card-col-id clickable-id" onClick={() => setSelectedInvoice(inv)} style={{ cursor: 'pointer', textDecoration: 'underline' }}>
          {inv.id}
        </div>
        <div className="card-col-supplier">
          <div className="supplier-logo-wrap" style={{ backgroundColor: logo.bg, color: logo.color }}>{logo.char}</div>
          <div className="supplier-info">
            <span className="supplier-name">{inv.supplier}</span>
            <span className="supplier-sub">Vendor Partner</span>
          </div>
        </div>
        <div className="card-col-taxable">
          <span className="val-main">₹{inr(inv.taxable)}</span>
          <span className="val-sub">INR</span>
        </div>
        <div className="card-col-gst">
          <span className="val-main">₹{inr(inv.gst)}</span>
          <span className="val-sub">{inv.gstRate != null ? `${inv.gstRate}% GST` : '—'}</span>
        </div>
        <div className="card-col-hsn">
          <span className={`hsn-pill ${inv.hsnWarn ? 'is-warn' : ''}`}>
            {inv.hsn}
            {inv.hsnWarn && <span className="hsn-warn-dot">⚠</span>}
          </span>
        </div>
        {listClass === 'im-row-card' && (
          <div className="card-col-itc">
            <div className="cpu-bar-container">
              <div className="cpu-bars">
                {Array.from({ length: 10 }).map((_, bIdx) => (
                  <span key={bIdx} className={`cpu-bar ${bIdx < barCount ? 'is-lit' : ''} ${statusClass}`} />
                ))}
              </div>
              <span className="cpu-percentage">{barCount * 10}%</span>
            </div>
          </div>
        )}
        {listClass === 'im-row-card' && (
          <div className="card-col-status">
            <span className={`service-status-badge ${statusClass}`}>{inv.status}</span>
          </div>
        )}
      </div>
    );
  }

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
          {!isAdmin && profile?.name && <span className="db-navbar-client-name">{profile.name}</span>}
          {isAdmin && clients.length > 0 && (
            <select
              className="client-selector"
              value={selectedClientId || ''}
              onChange={(e) => setSelectedClientId(e.target.value)}
              title="Switch client"
            >
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <button type="button" className="navbar-action-btn" onClick={handleRunReconcile} title="Run reconciliation now">
            Run Check
          </button>
          
          <div className="db-nav-pill">
            <button className="nav-pill-btn" onClick={() => window.location.href = '/'} title="Home">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9 22 9 12 15 12 15 22"></polyline>
              </svg>
            </button>
            
            <div className="notif-bell-wrapper">
              <button className="notif-bell-btn" onClick={() => setShowNotifDropdown(!showNotifDropdown)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {(commitments.filter((c) => c.daysLeft < 2).length + alerts.length) > 0 && (
                  <span className="notif-badge-count">{commitments.filter((c) => c.daysLeft < 2).length + alerts.length}</span>
                )}
              </button>
              {showNotifDropdown && (
                <div className="notif-dropdown">
                  <div className="notif-dropdown-arrow" />
                  {alerts.slice(0, 5).map((a) => (
                    <div key={a.id} className="notif-dropdown-item">
                      <svg className="notif-item-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                      <div className="notif-item-content">
                        <div className="notif-item-title">{a.message}</div>
                        <div className="notif-item-sub">{a.severity} severity · {a.type}</div>
                      </div>
                    </div>
                  ))}
                  {commitments.filter((c) => c.daysLeft < 2).map((c, i) => (
                    <div key={`c-${i}`} className="notif-dropdown-item">
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
                  {alerts.length === 0 && commitments.filter((c) => c.daysLeft < 2).length === 0 && (
                    <div className="notif-dropdown-item"><div className="notif-item-content">Nothing urgent right now.</div></div>
                  )}
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
          <div className="db-navbar-profile" title={identity?.name || identity?.email || ''}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4"/>
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
            </svg>
          </div>
          {onOpenRiskGraph && (
            <button type="button" className="navbar-action-btn navbar-action-btn-highlight" onClick={onOpenRiskGraph} title="3D supplier risk graph">
              🌐 Risk Graph
            </button>
          )}
          {onLogout && (
            <button type="button" className="navbar-action-btn" onClick={onLogout} title="Log out">Log out</button>
          )}
        </div>
      </nav>

      {(statusMsg || loadError) && (
        <div className="db-status-banner">{loadError || statusMsg}</div>
      )}

      {/* ── Live Ticker (real GST buckets from this client's own data) ── */}
      <div className="db-ticker">
        <div className="db-ticker-track">
          <div className="db-ticker-content">
            {tickerBuckets.map((t, i) => <span key={i} className="ticker-item">{t}</span>)}
            {tickerBuckets.map((t, i) => <span key={`r-${i}`} className="ticker-item">{t}</span>)}
          </div>
          <div className="db-ticker-content">
            {tickerBuckets.map((t, i) => <span key={`b-${i}`} className="ticker-item">{t}</span>)}
            {tickerBuckets.map((t, i) => <span key={`c-${i}`} className="ticker-item">{t}</span>)}
          </div>
        </div>
      </div>

      <div className="dashboard-scroll">

        {/* ── Hero Money Story ── */}
        <div className="db-hero-money-row">
          <div className={`db-hero-money-card ${sl(0)}`}>
            <span className="db-hero-money-label">
              {isAdmin ? 'ITC unlocked for this client (resolved issues)' : 'Money you unlocked without a CA this month'}
            </span>
            <span className="db-hero-money-value">₹{inr(moneyUnlocked)}</span>
            <span className="db-hero-money-desc">From issues marked "Fixed" after a supplier correction.</span>
          </div>
          <div className={`db-health-score-card ${sl(1)}`}>
            <span className="db-hero-money-label">Compliance Health Score</span>
            <div className="db-health-score-ring" style={{ '--score': healthScore }}>
              <span className="db-health-score-value">{healthScore}</span>
              <span className="db-health-score-max">/100</span>
            </div>
            <span className="db-hero-money-desc">
              {healthScore >= 85 ? 'Excellent — ready to file.' : healthScore >= 60 ? 'Good, a few issues to clear.' : 'Needs attention before filing.'}
            </span>
          </div>
        </div>

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
              value: <span className="db-green">{summary?.total_invoices ?? 0}</span>,
              desc: 'Cumulative invoices generated',
              clickable: true,
            },
            {
              label: isAdmin ? 'Issue Mix' : 'Open Issues', icon: '↻',
              value: <span>{summary?.total_issues ?? 0}</span>,
              desc: 'Number of open issues recorded',
              clickable: true,
              onClick: () => setShowReconPopup(true),
            },
            {
              label: isAdmin ? 'ITC Exposure' : 'Total ITC Risks',
              icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                </svg>
              ),
              value: <span className="db-blue">₹{inr(summary?.itc_at_risk)}</span>,
              desc: 'Total input tax credit at risk',
              clickable: true,
              onClick: () => setShowItcPopup(true),
            },
            {
              label: 'Alerts & Reminders', icon: '◷',
              value: <span>{alerts.length + remindersDue.length}</span>,
              desc: isAdmin ? 'Open alerts + reminders due this period' : 'HSN code discrepancies detected',
              clickable: isAdmin,
              onClick: isAdmin ? () => setShowAlertsPopup(true) : undefined,
            },
          ].map((card, i) => (
            <div
              key={i}
              className={`db-stat-card ${sl(i + 2)} ${card.clickable ? 'clickable-stat-card' : ''}`}
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
          <div className={`db-chart-card ${sl(6)}`}>
            <div className="db-chart-header">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
                stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
                <line x1="6" y1="20" x2="6" y2="14"/>
              </svg>
              <h2 className="db-chart-title">ITC At Risk Over Time</h2>
            </div>
            <div className="db-chart-area">
              <LineChart data={itcTrend} color="#10b981" gradientId="salesGrad" yMin={0} yMax={itcTrendMax} />
            </div>
            <div className="db-chart-legend" style={{ color: '#10b981' }}>⟿ ITC at risk per reconciliation run</div>
          </div>

          <div className={`db-chart-card ${sl(7)}`}>
            <div className="db-chart-header">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
                stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
                <line x1="6" y1="20" x2="6" y2="14"/>
              </svg>
              <h2 className="db-chart-title">Open Issues Over Time</h2>
            </div>
            <div className="db-chart-area">
              <LineChart data={issuesTrend} color="#10b981" gradientId="revGrad" yMin={0} yMax={issuesTrendMax} />
            </div>
            <div className="db-chart-legend" style={{ color: '#10b981' }}>⟿ Issues per reconciliation run</div>
          </div>
        </div>

        {/* ── Logs-Style Commitments ── */}
        <div className={`db-payments-card logs-card ${sl(7)}`} style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="logs-header">
            <h2 className="logs-title">Commitments</h2>
            <p className="logs-sub">{commitments.length} supplier follow-up(s) outstanding · highest value first</p>
            <div className="logs-search-wrapper">
              <div className="logs-search-input-box">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input type="text" placeholder="Search commitments by message or supplier..." disabled />
              </div>
            </div>
          </div>
          <div className="db-payments-list logs-list">
            {commitments.length > 0 ? commitments.map((c, i) => (
              <div key={i} className="logs-row" style={{ cursor: 'pointer' }} onClick={() => handleDraftMessage(c.issue.id)}>
                <div className="logs-supplier">{c.supplier}</div>
                <div className="logs-desc">{c.gstValue}</div>
                <div className="logs-days" style={{ color: c.daysLeft >= 0 ? '#10b981' : '#ef4444' }}>
                  {c.daysLeft} Days
                </div>
              </div>
            )) : (
              <div className="im-empty-card">No open supplier follow-ups — all clear!</div>
            )}
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
            {loading ? (
              <div className="im-empty-card">Loading…</div>
            ) : filteredInvoices.length > 0 ? (
              filteredInvoices.map((inv) => renderInvoiceRow(inv, 'im-row-card'))
            ) : (
              <div className="im-empty-card">No invoices found matching criteria.</div>
            )}
          </div>
        </div>

        <div className="im-action-buttons">
          <button className="im-glass-btn" onClick={() => setShowUploadMenu(!showUploadMenu)}>Import</button>
          <button className="im-glass-btn" onClick={() => baselineFileRef.current?.click()}>Upload GSTR-2B</button>
          <button className="im-glass-btn" onClick={() => scopedApi.downloadReport()}>Download Report (PDF)</button>

          {showUploadMenu && (
            <div className="upload-popup-menu">
              <div className="upload-menu-item" onClick={() => invoiceFileRef.current?.click()}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                <span>Add files or photos (invoice / PDF)</span>
              </div>
            </div>
          )}
          <input
            ref={invoiceFileRef}
            type="file"
            accept=".csv,.xlsx,.pdf,image/*"
            style={{ display: 'none' }}
            onChange={(e) => handleFileSelected('invoices', e.target.files?.[0])}
          />
          <input
            ref={baselineFileRef}
            type="file"
            accept=".csv,.xlsx,.pdf"
            style={{ display: 'none' }}
            onChange={(e) => handleFileSelected('baseline', e.target.files?.[0])}
          />
        </div>
      </div>

      {/* ── Policy Modal Overlay ── */}
      {selectedInvoice && (
        <div className="policy-modal-overlay" onClick={() => setSelectedInvoice(null)}>
          <div className="policy-card comparison-card" onClick={(e) => e.stopPropagation()}>
            <div className="pc-top-row">
              <div className="pc-avatar-wrap">
                <div className="pc-avatar">
                  {selectedInvoice.supplier.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()}
                </div>
                <div className="pc-meta">
                  <span className="pc-badge-expire">{selectedInvoice.status}</span>
                  <span className="pc-date-subtitle">{selectedInvoice.period}</span>
                </div>
              </div>
            </div>

            {selectedInvoice.itc > 0 && (
              <div className="pc-money-banner">
                Fixing this = <strong>+₹{inr(selectedInvoice.itc)} ITC</strong> this month
              </div>
            )}

            <div className="comp-title">BOOKS VS GSTR-2B</div>

            <table className="comp-table">
              <thead>
                <tr>
                  <th align="left">Field</th>
                  <th align="left">In books</th>
                  <th align="left">In GSTR-2B</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="comp-field-label">Vendor name</td>
                  <td className={`comp-val-books ${fieldDiffers(selectedInvoice.fieldDiffs, 'vendor_name') ? 'comp-diff' : ''}`}>{selectedInvoice.book?.vendor_name || '—'}</td>
                  <td className={`comp-val-books ${fieldDiffers(selectedInvoice.fieldDiffs, 'vendor_name') ? 'comp-diff' : ''}`}>{selectedInvoice.gstr2b?.vendor_name || '—'}</td>
                </tr>
                <tr>
                  <td className="comp-field-label">Taxable value</td>
                  <td className={`comp-val-books ${fieldDiffers(selectedInvoice.fieldDiffs, 'taxable_value') ? 'comp-diff' : ''}`}>{selectedInvoice.book ? `₹${inr(selectedInvoice.book.taxable_value)}` : '—'}</td>
                  <td className={`comp-val-books ${fieldDiffers(selectedInvoice.fieldDiffs, 'taxable_value') ? 'comp-diff' : ''}`}>{selectedInvoice.gstr2b ? `₹${inr(selectedInvoice.gstr2b.taxable_value)}` : '—'}</td>
                </tr>
                <tr>
                  <td className="comp-field-label">GST rate</td>
                  <td className={`comp-val-books ${fieldDiffers(selectedInvoice.fieldDiffs, 'gst_rate') ? 'comp-diff' : ''}`}>{selectedInvoice.book ? `${selectedInvoice.book.gst_rate}%` : '—'}</td>
                  <td className={`comp-val-books ${fieldDiffers(selectedInvoice.fieldDiffs, 'gst_rate') ? 'comp-diff' : ''}`}>{selectedInvoice.gstr2b ? `${selectedInvoice.gstr2b.gst_rate}%` : '—'}</td>
                </tr>
                <tr>
                  <td className="comp-field-label">GST amount</td>
                  <td className={`comp-val-books ${fieldDiffers(selectedInvoice.fieldDiffs, 'gst_amount') ? 'comp-diff' : ''}`}>{selectedInvoice.book ? `₹${inr(selectedInvoice.book.gst_amount)}` : '—'}</td>
                  <td className={`comp-val-books ${fieldDiffers(selectedInvoice.fieldDiffs, 'gst_amount') ? 'comp-diff' : ''}`}>{selectedInvoice.gstr2b ? `₹${inr(selectedInvoice.gstr2b.gst_amount)}` : '—'}</td>
                </tr>
                <tr>
                  <td className="comp-field-label">HSN code</td>
                  <td className={`comp-val-books ${fieldDiffers(selectedInvoice.fieldDiffs, 'hsn_code') ? 'comp-diff' : ''}`}>{selectedInvoice.book?.hsn_code || '—'}</td>
                  <td className={`comp-val-books ${fieldDiffers(selectedInvoice.fieldDiffs, 'hsn_code') ? 'comp-diff' : ''}`}>{selectedInvoice.gstr2b?.hsn_code || '—'}</td>
                </tr>
                <tr>
                  <td className="comp-field-label">Invoice date</td>
                  <td className="comp-val-books" colSpan={2}>{selectedInvoice.invoiceDate || '—'}</td>
                </tr>
              </tbody>
            </table>

            {selectedInvoice.issues.length > 0 && (
              <div className="pc-issues-list">
                {selectedInvoice.issues.map((issue, idx) => (
                  <div key={idx} className="pc-issue-row">
                    <div className="comp-field-label">{issue.action_card?.title || issue.type}</div>
                    <div className="comp-val-books pc-samjhao-text">
                      💡 <strong>Samjhao:</strong> {issue.action_card?.plain_problem || issue.message}{' '}
                      {issue.action_card?.money_reason || ''}
                    </div>
                    <div className="comp-val-books"><strong>Next step:</strong> {issue.action_card?.next_action || issue.recommendation}</div>
                    <div className="pc-issue-actions">
                      <button className="pc-update-btn" onClick={() => handleDraftMessage(issue.issue_key)} disabled={!issue.issue_key}>
                        Send Correction Request
                      </button>
                      <button className="pc-update-btn" onClick={() => handleIssueStatus(issue.issue_key, 'chasing')} disabled={!issue.issue_key}>
                        Mark Sent / Following Up
                      </button>
                      <button className="pc-update-btn pc-update-btn-success" onClick={() => handleIssueStatus(issue.issue_key, 'resolved')} disabled={!issue.issue_key}>
                        Mark Fixed ✓
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Draft Message Preview ── */}
      {draftPreview && (
        <div className="policy-modal-overlay" onClick={() => setDraftPreview(null)}>
          <div className="policy-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="comp-title">SUPPLIER CORRECTION REQUEST</div>
            <p className="pc-samjhao-text" style={{ whiteSpace: 'pre-wrap' }}>{draftPreview}</p>
            <p className="pc-draft-disclaimer">Generated from already-computed issue data — no invented amounts. Copy and forward on WhatsApp.</p>
            <button className="pc-update-btn" onClick={() => { navigator.clipboard?.writeText(draftPreview); setStatusMsg('Draft copied to clipboard.'); }}>
              Copy Message
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
            <p className="recon-popup-subtitle">
              Missing from GSTR-2B = supplier hasn't filed it (chase the supplier). Missing in books = filed by supplier
              but not recorded by you (a bookkeeping gap to verify).
            </p>
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
              />
            );
          })}
        </div>

        <div className="recon-legend">
          {reconCategories.map(cat => (
            <div key={cat.label} className="recon-legend-item">
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
              itcInvoices.map((inv) => renderInvoiceRow(inv, 'itc-row-card'))
            ) : (
              <div className="im-empty-card">No invoices found.</div>
            )}
          </div>
        </div>
      </div>

      {/* ── Alerts & Reminders Popup (admin only) ── */}
      {isAdmin && (
        <div className={`recon-popup ${showAlertsPopup ? 'is-open' : ''}`}>
          <div className="im-header" style={{ marginBottom: 24, padding: 0 }}>
            <div className="recon-popup-header" style={{ margin: 0, textAlign: 'left' }}>
              <h2 className="recon-popup-title">
                {showAlertsPopup && <Typewriter text="Alerts & Reminders" speed={60} />}
              </h2>
              <p className="recon-popup-subtitle">Firm-wide smart alerts and clients due a recovery nudge.</p>
            </div>
            <button className="im-close-btn" onClick={() => setShowAlertsPopup(false)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div className="recon-legend">
            <p className="pc-draft-disclaimer" style={{ marginBottom: 8 }}>Alerts</p>
            {alerts.length === 0 && <div className="im-empty-card">No open alerts.</div>}
            {alerts.map((a) => (
              <div key={a.id} className="recon-legend-item">
                <div className="recon-legend-item-left">
                  <div className="recon-legend-dot" style={{ backgroundColor: a.severity === 'high' ? '#ef4444' : a.severity === 'medium' ? '#eab308' : '#60a5fa' }} />
                  <span>{a.message}</span>
                </div>
                <button
                  className="pc-update-btn"
                  style={{ width: 'auto', padding: '6px 10px' }}
                  onClick={() => caApi.ackAlert(a.id).then(() => setAlerts((prev) => prev.filter((x) => x.id !== a.id)))}
                >
                  Ack
                </button>
              </div>
            ))}
            <p className="pc-draft-disclaimer" style={{ margin: '16px 0 8px' }}>Reminders due this period</p>
            {remindersDue.length === 0 && <div className="im-empty-card">No reminders due.</div>}
            {remindersDue.map((r, i) => (
              <div key={i} className="recon-legend-item">
                <div className="recon-legend-item-left">
                  <span>{r.client_name} — {r.suggested_message}</span>
                </div>
                <span className="recon-legend-count">₹{inr(r.itc_at_risk)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
