import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import SpriteText from 'three-spritetext';
import { caApi } from '../api/client';
import { useGSTTickerData } from '../hooks/useGSTTickerData';

const RATING_COLOR = { red: '#ef4444', yellow: '#eab308', green: '#10b981' };

function healthColor(score) {
  if (score >= 85) return '#10b981';
  if (score >= 60) return '#eab308';
  return '#ef4444';
}

function inr(value) {
  return Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function nodeColor(node) {
  if (node.type === 'client') return healthColor(node.health_score);
  return RATING_COLOR[node.rating] || RATING_COLOR.green;
}

function nodeSize(node) {
  if (node.type === 'client') {
    return 4 + Math.min(Math.sqrt(node.itc_at_risk || 0) / 12, 14);
  }
  return 4 + Math.min(Math.sqrt(node.total_itc_at_risk || 0) / 10, 16) + (node.clients_affected || 0) * 1.5;
}

function linkColor(link) {
  if (link.missing_from_2b_count > 0) return '#ef4444';
  if (link.rupee_at_risk > 2000) return '#f59e0b';
  if (link.rupee_at_risk > 0) return '#eab308';
  return 'rgba(148, 163, 184, 0.35)';
}

function linkWidth(link) {
  return 0.6 + Math.min(Math.sqrt(link.rupee_at_risk || 0) / 18, 6);
}

export default function VendorRiskGraphPage({ onBack }) {
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [selectedNode, setSelectedNode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const fgRef = useRef();

  useEffect(() => {
    caApi.listClients().then(setClients).catch(() => {});
  }, []);

  const loadGraph = useCallback(async () => {
    setLoading(true);
    setStatusMsg('');
    try {
      const data = await caApi.getRiskGraph3D(selectedClientId ? { client_id: selectedClientId } : {});
      setGraphData(data);
      if (data.nodes.length === 0) {
        setStatusMsg('Graph is empty — click "Sync from Neo4j" to build it from current data.');
      }
    } catch (err) {
      setStatusMsg(`Could not load graph: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [selectedClientId]);

  useEffect(() => {
    loadGraph();
  }, [loadGraph]);

  async function handleSync() {
    setSyncing(true);
    setStatusMsg('Syncing MongoDB → Neo4j…');
    try {
      const result = await caApi.syncRiskGraph();
      setStatusMsg(`Synced ${result.clients_synced} clients, ${result.suppliers_synced} suppliers, ${result.edges_synced} relationships.`);
      await loadGraph();
    } catch (err) {
      setStatusMsg(`Sync failed: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  }

  const stats = useMemo(() => {
    const suppliers = graphData.nodes.filter((n) => n.type === 'supplier');
    const red = suppliers.filter((n) => n.rating === 'red').length;
    const yellow = suppliers.filter((n) => n.rating === 'yellow').length;
    const totalRupeeAtRisk = graphData.links.reduce((sum, l) => sum + (l.rupee_at_risk || 0), 0);
    return { supplierCount: suppliers.length, red, yellow, totalRupeeAtRisk };
  }, [graphData]);

  const { usdInr, fetchTime, deadlines, slabs, facts } = useGSTTickerData();

  const riskTickerItems = useMemo(() => {
    const items = [];
    if (usdInr) items.push({ text: `USD/INR  \u20b9${usdInr}${fetchTime ? `  (${fetchTime})` : ''}`, cls: 'ticker-item ticker-item--live' });
    const { period, gstr1, gstr3b } = deadlines;
    const dc = (d) => d.days <= 5 ? 'ticker-item ticker-item--urgent' : 'ticker-item ticker-item--deadline';
    items.push({ text: `${gstr1.label} (${period})  Due ${gstr1.date}  \u2014  ${gstr1.days}d left`, cls: dc(gstr1) });
    items.push({ text: `${gstr3b.label} (${period})  Due ${gstr3b.date}  \u2014  ${gstr3b.days}d left`, cls: dc(gstr3b) });
    for (const s of slabs) items.push({ text: `GST ${s.rate}  ${s.desc}`, cls: 'ticker-item ticker-item--rate' });
    for (const f of facts) items.push({ text: `${f.label}:  ${f.value}`, cls: 'ticker-item ticker-item--fact' });
    return items;
  }, [usdInr, fetchTime, deadlines, slabs, facts]);

  return (
    <div className="risk-graph-page">
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
          <select
            className="client-selector"
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
          >
            <option value="">All Clients (firm-wide)</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button type="button" className="navbar-action-btn" onClick={handleSync} disabled={syncing}>
            {syncing ? 'Syncing…' : 'Sync from Neo4j'}
          </button>
          <button type="button" className="navbar-action-btn" onClick={onBack}>
            Back to Dashboard
          </button>
        </div>
      </nav>

      <div className="risk-graph-title-row">
        <h1 className="risk-graph-title">Supplier-Client Risk Graph</h1>
        <p className="risk-graph-subtitle">
          A live Neo4j graph of every supplier relationship across the firm — node color and size encode risk,
          edge thickness encodes rupees at risk. Rotate, zoom, and click any node to inspect it.
        </p>
      </div>

      {statusMsg && <div className="db-status-banner">{statusMsg}</div>}

      {/* ── Live Ticker (GST rates, filing deadlines, live FX) ── */}
      <div className="db-ticker">
        <div className="db-ticker-live-label">
          <span className="db-ticker-live-dot" />
          LIVE
        </div>
        <div className="db-ticker-track">
          <div className="db-ticker-content">
            {riskTickerItems.map((t, i) => <span key={i} className={t.cls}>{t.text}</span>)}
            {riskTickerItems.map((t, i) => <span key={`r-${i}`} className={t.cls}>{t.text}</span>)}
          </div>
          <div className="db-ticker-content">
            {riskTickerItems.map((t, i) => <span key={`b-${i}`} className={t.cls}>{t.text}</span>)}
            {riskTickerItems.map((t, i) => <span key={`c-${i}`} className={t.cls}>{t.text}</span>)}
          </div>
        </div>
      </div>

      <div className="risk-graph-body">
        <div className="risk-graph-canvas-wrap">
          {loading ? (
            <div className="im-empty-card" style={{ margin: 40 }}>Loading graph…</div>
          ) : (
            <ForceGraph3D
              ref={fgRef}
              graphData={graphData}
              backgroundColor="#0a0c14"
              nodeId="id"
              nodeLabel={(n) =>
                n.type === 'client'
                  ? `${n.label}<br/>Health: ${n.health_score}/100<br/>ITC at risk: ₹${inr(n.itc_at_risk)}`
                  : `${n.label}<br/>Rating: ${n.rating}<br/>Risk score: ${n.risk_score}/100<br/>Clients affected: ${n.clients_affected}`
              }
              nodeColor={nodeColor}
              nodeVal={nodeSize}
              nodeOpacity={0.95}
              nodeThreeObject={(n) => {
                const sprite = new SpriteText(n.label);
                sprite.color = n.type === 'client' ? '#e5e7eb' : '#94a3b8';
                sprite.textHeight = n.type === 'client' ? 4.5 : 3.4;
                sprite.backgroundColor = 'rgba(10,12,20,0.55)';
                sprite.padding = 1.5;
                sprite.borderRadius = 2;
                return sprite;
              }}
              nodeThreeObjectExtend={true}
              linkColor={linkColor}
              linkWidth={linkWidth}
              linkOpacity={0.65}
              linkDirectionalParticles={(l) => (l.rupee_at_risk > 0 ? 3 : 0)}
              linkDirectionalParticleWidth={1.6}
              linkDirectionalParticleSpeed={0.006}
              linkDirectionalParticleColor={() => '#f87171'}
              onNodeClick={(node) => {
                setSelectedNode(node);
                const distance = 80;
                const ratio = 1 + distance / Math.hypot(node.x || 1, node.y || 1, node.z || 1);
                fgRef.current?.cameraPosition(
                  { x: (node.x || 0) * ratio, y: (node.y || 0) * ratio, z: (node.z || 0) * ratio },
                  node,
                  800
                );
              }}
            />
          )}
        </div>

        <aside className="risk-graph-sidebar">
          <div className="risk-graph-legend">
            <h3>How to read this</h3>
            <div className="legend-row"><span className="legend-dot" style={{ background: '#ef4444' }} /> Red supplier = high risk (repeat offender / unresolved ITC)</div>
            <div className="legend-row"><span className="legend-dot" style={{ background: '#eab308' }} /> Yellow supplier = moderate risk</div>
            <div className="legend-row"><span className="legend-dot" style={{ background: '#10b981' }} /> Green = clean / low risk</div>
            <div className="legend-row"><span className="legend-line" /> Edge thickness = ₹ ITC at risk in that relationship</div>
            <div className="legend-row"><span className="legend-particles">•••</span> Flowing dots = money currently at risk on that link</div>
            <div className="legend-row">Node size = exposure (bigger = more at stake)</div>
          </div>

          <div className="risk-graph-stats">
            <div className="risk-stat"><span>Suppliers in view</span><strong>{stats.supplierCount}</strong></div>
            <div className="risk-stat"><span>Red-rated</span><strong style={{ color: '#ef4444' }}>{stats.red}</strong></div>
            <div className="risk-stat"><span>Yellow-rated</span><strong style={{ color: '#eab308' }}>{stats.yellow}</strong></div>
            <div className="risk-stat"><span>Total ₹ at risk shown</span><strong>₹{inr(stats.totalRupeeAtRisk)}</strong></div>
          </div>

          {selectedNode && (
            <div className="risk-graph-detail">
              <h3>{selectedNode.label}</h3>
              {selectedNode.type === 'client' ? (
                <>
                  <p className="risk-detail-row"><span>Type</span><strong>Client</strong></p>
                  <p className="risk-detail-row"><span>Health score</span><strong style={{ color: healthColor(selectedNode.health_score) }}>{selectedNode.health_score}/100</strong></p>
                  <p className="risk-detail-row"><span>ITC at risk</span><strong>₹{inr(selectedNode.itc_at_risk)}</strong></p>
                  <p className="risk-detail-row"><span>Open issues</span><strong>{selectedNode.total_issues}</strong></p>
                </>
              ) : (
                <>
                  <p className="risk-detail-row"><span>Type</span><strong>Supplier</strong></p>
                  <p className="risk-detail-row"><span>Rating</span><strong style={{ color: RATING_COLOR[selectedNode.rating] }}>{selectedNode.rating?.toUpperCase()}</strong></p>
                  <p className="risk-detail-row"><span>Risk score (forecast)</span><strong>{selectedNode.risk_score}/100 ({selectedNode.risk_level})</strong></p>
                  <p className="risk-detail-row"><span>Clients affected</span><strong>{selectedNode.clients_affected}</strong></p>
                  <p className="risk-detail-row"><span>Total ITC at risk</span><strong>₹{inr(selectedNode.total_itc_at_risk)}</strong></p>
                  <p className="risk-detail-row"><span>Unresolved amount</span><strong>₹{inr(selectedNode.unresolved_amount)}</strong></p>
                </>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
