/**
 * useGSTTickerData
 *
 * Provides three streams of data for the top navbar ticker:
 *   1. Live USD/INR exchange rate (fetched from open.er-api.com – free, no API key)
 *   2. GST filing deadlines computed from the current calendar date
 *   3. Static but authoritative GST slab rates and compliance thresholds
 *
 * The hook auto-refreshes exchange rates every 30 minutes.
 */

import { useState, useEffect } from 'react';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ── GST rate slabs (set by GST Council) ──────────────────────────────────────
export const GST_SLABS = [
  { rate: '0%',  desc: 'Grains, Milk, Fresh Veg, Salt' },
  { rate: '5%',  desc: 'Packed Food, Tea, Edible Oil, Sugar' },
  { rate: '12%', desc: 'Butter, Ghee, Computers, Mobile Phones' },
  { rate: '18%', desc: 'Hair Oil, Soaps, Capital Goods, IT Services' },
  { rate: '28%', desc: 'ACs, Dishwashers, Aerated Drinks, Cars' },
];

// ── Compliance constants (current legal rates & thresholds) ──────────────────
export const COMPLIANCE_FACTS = [
  { label: 'ITC Interest §50 CGST',        value: '18% p.a.' },
  { label: 'Late fee GSTR-1',               value: '₹50/day  (₹20 nil-return)' },
  { label: 'Late fee GSTR-3B',              value: '₹50/day  (₹20 nil-return)' },
  { label: 'ITC reversal Rule 37',          value: '180 days non-payment' },
  { label: 'Annual return GSTR-9',          value: 'Due 31 Dec each year' },
  { label: 'QRMP scheme cap',               value: 'Turnover ≤ ₹5 Cr' },
  { label: 'Composition levy cap',          value: 'Turnover ≤ ₹1.5 Cr' },
  { label: 'Reg. threshold (goods)',        value: '₹40 L annual turnover' },
  { label: 'Reg. threshold (services)',     value: '₹20 L annual turnover' },
  { label: 'E-invoice threshold',           value: 'Turnover > ₹5 Cr' },
];

// ── Compute filing deadlines from today ──────────────────────────────────────
function getFilingDeadlines() {
  const now  = new Date();
  const y    = now.getFullYear();
  const m    = now.getMonth();           // 0-indexed
  const ny   = m === 11 ? y + 1 : y;
  const nm   = m === 11 ? 0    : m + 1;

  // GSTR-1  → 11th of next month (monthly filers)
  // GSTR-3B → 20th of next month (monthly filers)
  // GSTR-2B → available 14th of next month (read-only)
  const gstr1Due  = new Date(ny, nm, 11);
  const gstr3bDue = new Date(ny, nm, 20);
  const gstr2bAvl = new Date(ny, nm, 14);

  const msDay = 864e5; // ms per day
  const daysLeft = (d) => Math.ceil((d - now) / msDay);

  return {
    period : `${MONTHS[m]} ${y}`,
    gstr1  : { label: 'GSTR-1',  date: `${MONTHS[nm]} 11, ${ny}`, days: daysLeft(gstr1Due)  },
    gstr3b : { label: 'GSTR-3B', date: `${MONTHS[nm]} 20, ${ny}`, days: daysLeft(gstr3bDue) },
    gstr2b : { label: 'GSTR-2B', date: `${MONTHS[nm]} 14, ${ny}`, days: daysLeft(gstr2bAvl), note: 'available' },
  };
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useGSTTickerData() {
  const [usdInr,    setUsdInr]    = useState(null);
  const [fetchTime, setFetchTime] = useState(null);
  const [deadlines, setDeadlines] = useState(() => getFilingDeadlines());

  useEffect(() => {
    let cancelled = false;

    async function fetchFx() {
      try {
        const res  = await fetch('https://open.er-api.com/v6/latest/USD', {
          signal: AbortSignal.timeout(8000),
        });
        const json = await res.json();
        if (!cancelled && json.result === 'success' && json.rates?.INR) {
          setUsdInr(Number(json.rates.INR).toFixed(2));
          setFetchTime(
            new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
          );
        }
      } catch {
        // Fail silently — ticker works fine with static data alone
      }
    }

    fetchFx();

    // Refresh rate + recompute deadlines every 30 minutes
    const id = setInterval(() => {
      fetchFx();
      if (!cancelled) setDeadlines(getFilingDeadlines());
    }, 30 * 60 * 1000);

    return () => { cancelled = true; clearInterval(id); };
  }, []);

  return { usdInr, fetchTime, deadlines, slabs: GST_SLABS, facts: COMPLIANCE_FACTS };
}
