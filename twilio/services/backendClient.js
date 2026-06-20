const axios = require("axios");
const FormData = require("form-data");

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

const client = axios.create({
  baseURL: BACKEND_URL,
  headers: process.env.SERVICE_TOKEN ? { "X-Service-Token": process.env.SERVICE_TOKEN } : {},
});

async function extractInvoice(fileBuffer, filename, contentType) {
  const form = new FormData();
  form.append("file", fileBuffer, { filename, contentType });
  const { data } = await client.post("/extract-invoice", form, {
    headers: form.getHeaders(),
  });
  return data;
}

async function uploadBaseline(traderId, fileBuffer, filename, contentType) {
  const form = new FormData();
  form.append("file", fileBuffer, { filename, contentType });
  const { data } = await client.post("/2b/upload", form, {
    headers: form.getHeaders(),
    params: { trader_id: traderId },
  });
  return data;
}

async function confirmInvoice(traderId, invoice) {
  const { data } = await client.post("/invoices/confirm", invoice, {
    params: { trader_id: traderId },
  });
  return data;
}

async function confirmBatch(traderId, invoices) {
  const { data } = await client.post("/invoices/confirm-batch", invoices, {
    params: { trader_id: traderId },
  });
  return data;
}

async function resetInvoices(traderId) {
  const { data } = await client.post("/invoices/reset", null, {
    params: { trader_id: traderId },
  });
  return data;
}

async function runReconciliation(traderId, language) {
  const { data } = await client.post(`/reconcile/${encodeURIComponent(traderId)}`, null, {
    params: { language },
  });
  return data;
}

async function getTraderSummary(traderId) {
  const { data } = await client.get(`/traders/${encodeURIComponent(traderId)}/summary`);
  return data;
}

async function getTraderContext(traderId) {
  const { data } = await client.get(`/traders/${encodeURIComponent(traderId)}/context`);
  return data;
}

async function getTraderReport(traderId) {
  const res = await client.get(`/traders/${encodeURIComponent(traderId)}/report`, {
    responseType: "arraybuffer",
  });
  return Buffer.from(res.data);
}

module.exports = {
  extractInvoice,
  uploadBaseline,
  confirmInvoice,
  confirmBatch,
  resetInvoices,
  runReconciliation,
  getTraderSummary,
  getTraderContext,
  getTraderReport,
};
