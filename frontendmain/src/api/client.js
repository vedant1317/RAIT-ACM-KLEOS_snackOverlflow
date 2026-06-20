// Thin fetch wrapper around the Munshi FastAPI backend. Two independent
// auth scopes live side by side: "ca" (the CA firm's admin login) and
// "client" (a single CA client's self-service portal login) — each keeps
// its own bearer token in localStorage so a CA admin and a client can even
// be logged in in two different tabs without clobbering each other.

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const TOKEN_KEYS = { ca: 'munshi_ca_token', client: 'munshi_client_token' };

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export function getToken(scope) {
  return localStorage.getItem(TOKEN_KEYS[scope]);
}

export function setToken(scope, token) {
  if (token) localStorage.setItem(TOKEN_KEYS[scope], token);
  else localStorage.removeItem(TOKEN_KEYS[scope]);
}

function qs(params = {}) {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (entries.length === 0) return '';
  return `?${new URLSearchParams(entries).toString()}`;
}

async function request(scope, path, { method = 'GET', body, isForm = false, isBlob = false } = {}) {
  const headers = {};
  const token = getToken(scope);
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload = body;
  if (body !== undefined && !isForm) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, { method, headers, body: payload });
  } catch {
    throw new ApiError('Could not reach the backend. Is it running?', 0);
  }

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const data = await res.json();
      detail = data.detail || JSON.stringify(data);
    } catch {
      /* ignore non-JSON error bodies */
    }
    throw new ApiError(detail, res.status);
  }

  if (isBlob) return res.blob();
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function uploadFile(scope, path, file) {
  const form = new FormData();
  form.append('file', file);
  return request(scope, path, { method: 'POST', body: form, isForm: true });
}

async function downloadFile(scope, path, filename) {
  const blob = await request(scope, path, { isBlob: true });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// --------------------------------------------------------------------------- //
// CA admin API ("Admin Mode")
// --------------------------------------------------------------------------- //
export const caApi = {
  login: (email, password) => request('ca', '/ca/login', { method: 'POST', body: { email, password } }),
  logout: () => request('ca', '/ca/logout', { method: 'POST' }),
  portfolio: () => request('ca', '/ca/portfolio'),
  listClients: () => request('ca', '/ca/clients'),
  getClient: (id) => request('ca', `/ca/clients/${id}`),
  createClient: (payload) => request('ca', '/ca/clients', { method: 'POST', body: payload }),
  createPortalAccount: (id, payload) => request('ca', `/ca/clients/${id}/portal-account`, { method: 'POST', body: payload }),
  listInvoices: (id, params) => request('ca', `/ca/clients/${id}/invoices${qs(params)}`),
  uploadInvoices: (id, file) => uploadFile('ca', `/ca/clients/${id}/invoices/upload`, file),
  uploadBaseline: (id, file, period) => uploadFile('ca', `/ca/clients/${id}/baseline/upload${qs({ period })}`, file),
  getReconciliation: (id, params) => request('ca', `/ca/clients/${id}/reconciliation${qs(params)}`),
  getReconciliationHistory: (id) => request('ca', `/ca/clients/${id}/reconciliation/history`),
  runReconcile: (id, params) => request('ca', `/ca/clients/${id}/reconcile${qs(params)}`, { method: 'POST' }),
  listIssues: (id, params) => request('ca', `/ca/clients/${id}/issues${qs(params)}`),
  listAllIssues: (params) => request('ca', `/ca/issues${qs(params)}`),
  setIssueStatus: (id, payload) => request('ca', `/ca/clients/${id}/issues/status`, { method: 'POST', body: payload }),
  draftMessage: (id, payload) => request('ca', `/ca/clients/${id}/issues/draft-message`, { method: 'POST', body: payload }),
  listVendors: (params) => request('ca', `/ca/vendors${qs(params)}`),
  listClientVendors: (id) => request('ca', `/ca/clients/${id}/vendors`),
  vendorForecast: () => request('ca', '/ca/vendors/forecast'),
  listAlerts: (params) => request('ca', `/ca/alerts${qs(params)}`),
  ackAlert: (id) => request('ca', `/ca/alerts/${id}/ack`, { method: 'POST' }),
  remindersDue: () => request('ca', '/ca/reminders/due'),
  getTimeline: (id, params) => request('ca', `/ca/clients/${id}/timeline${qs(params)}`),
  simulate: (id, payload) => request('ca', `/ca/clients/${id}/simulate`, { method: 'POST', body: payload }),
  downloadReport: (id, period) => downloadFile('ca', `/ca/clients/${id}/reports/monthly${qs({ period })}`, `gst-report-${id}-${period || 'latest'}.pdf`),
};

// --------------------------------------------------------------------------- //
// Client self-service portal API ("Client Mode")
// --------------------------------------------------------------------------- //
export const clientApi = {
  login: (email, password) => request('client', '/client/login', { method: 'POST', body: { email, password } }),
  logout: () => request('client', '/client/logout', { method: 'POST' }),
  me: () => request('client', '/client/me'),
  listInvoices: (params) => request('client', `/client/invoices${qs(params)}`),
  uploadInvoices: (file) => uploadFile('client', '/client/invoices/upload', file),
  uploadBaseline: (file, period) => uploadFile('client', `/client/baseline/upload${qs({ period })}`, file),
  getReconciliation: (params) => request('client', `/client/reconciliation${qs(params)}`),
  getReconciliationHistory: () => request('client', '/client/reconciliation/history'),
  runReconcile: (params) => request('client', `/client/reconcile${qs(params)}`, { method: 'POST' }),
  listIssues: (params) => request('client', `/client/issues${qs(params)}`),
  setIssueStatus: (payload) => request('client', '/client/issues/status', { method: 'POST', body: payload }),
  draftMessage: (payload) => request('client', '/client/issues/draft-message', { method: 'POST', body: payload }),
  getVendors: () => request('client', '/client/vendors'),
  getTimeline: (params) => request('client', `/client/timeline${qs(params)}`),
  simulate: (payload) => request('client', '/client/simulate', { method: 'POST', body: payload }),
  downloadReport: (period) => downloadFile('client', `/client/reports/monthly${qs({ period })}`, `gst-report-${period || 'latest'}.pdf`),
};
