const axios = require("axios");
const FormData = require("form-data");

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

async function extractInvoice(fileBuffer, filename, contentType) {
  const form = new FormData();
  form.append("file", fileBuffer, { filename, contentType });
  const { data } = await axios.post(`${BACKEND_URL}/extract-invoice`, form, {
    headers: form.getHeaders(),
  });
  return data;
}

async function uploadBaseline(traderId, fileBuffer, filename, contentType) {
  const form = new FormData();
  form.append("file", fileBuffer, { filename, contentType });
  const { data } = await axios.post(`${BACKEND_URL}/2b/upload`, form, {
    headers: form.getHeaders(),
    params: { trader_id: traderId },
  });
  return data;
}

async function confirmInvoice(traderId, invoice) {
  const { data } = await axios.post(`${BACKEND_URL}/invoices/confirm`, invoice, {
    params: { trader_id: traderId },
  });
  return data;
}

async function resetInvoices(traderId) {
  const { data } = await axios.post(`${BACKEND_URL}/invoices/reset`, null, {
    params: { trader_id: traderId },
  });
  return data;
}

async function runReconciliation(traderId, language) {
  const { data } = await axios.post(`${BACKEND_URL}/reconcile/${traderId}`, null, {
    params: { language },
  });
  return data;
}

module.exports = {
  extractInvoice,
  uploadBaseline,
  confirmInvoice,
  resetInvoices,
  runReconciliation,
};
