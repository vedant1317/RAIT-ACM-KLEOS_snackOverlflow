const axios = require("axios");
const twilio = require("twilio");

const { Session } = require("../models/Session");

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";
const CA_ADMIN_TOKEN = process.env.CA_ADMIN_TOKEN || "";
const NUDGE_TEMPLATE_SID = process.env.NUDGE_TEMPLATE_SID || "";
const WHATSAPP_WINDOW_MS = 24 * 60 * 60 * 1000;

function backendApi() {
  return axios.create({
    baseURL: BACKEND_URL,
    headers: CA_ADMIN_TOKEN ? { Authorization: `Bearer ${CA_ADMIN_TOKEN}` } : {},
  });
}

function twilioClient() {
  return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

function toWhatsAppAddress(phone) {
  return phone.startsWith("whatsapp:") ? phone : `whatsapp:${phone}`;
}

async function withinWhatsAppWindow(address) {
  const session = await Session.findOne({ phone: address });
  if (!session || !session.updatedAt) return false;
  return Date.now() - session.updatedAt.getTime() < WHATSAPP_WINDOW_MS;
}

/**
 * Send one nudge, respecting WhatsApp's 24-hour session-messaging rule: a
 * free-form message only works if the trader messaged us within the last
 * 24h; outside that window, WhatsApp requires a pre-approved Content
 * Template. Without one configured, we skip rather than fire a message
 * that WhatsApp will reject.
 */
async function sendNudge(candidate) {
  const to = toWhatsAppAddress(candidate.contact_phone);
  const inWindow = await withinWhatsAppWindow(to);

  if (inWindow) {
    await twilioClient().messages.create({
      from: process.env.TWILIO_WHATSAPP_NUMBER,
      to,
      body: candidate.suggested_message,
    });
    return { sent: true, channel: "freeform" };
  }

  if (!NUDGE_TEMPLATE_SID) {
    return { sent: false, reason: "outside_24h_window_no_template_configured" };
  }

  await twilioClient().messages.create({
    from: process.env.TWILIO_WHATSAPP_NUMBER,
    to,
    contentSid: NUDGE_TEMPLATE_SID,
    contentVariables: JSON.stringify({ 1: candidate.client_name, 2: String(candidate.itc_at_risk) }),
  });
  return { sent: true, channel: "template" };
}

/**
 * Iterate clients due a monthly recovery nudge (per the backend's
 * deterministic ITC-at-risk threshold), send what we can, and record the
 * outcome against the backend's reminder record either way.
 */
async function runNudgeJob() {
  const api = backendApi();
  const { data: due } = await api.get("/ca/reminders/due");

  const results = [];
  for (const candidate of due) {
    try {
      const { data: reminder } = await api.post(`/ca/clients/${candidate.client_id}/reminders`, {
        period: candidate.period,
        message: candidate.suggested_message,
        channel: "whatsapp",
      });
      const outcome = await sendNudge(candidate);
      if (outcome.sent) {
        await api.post(`/ca/reminders/${reminder.id}/sent`);
      }
      results.push({ client_id: candidate.client_id, client_name: candidate.client_name, ...outcome });
    } catch (err) {
      results.push({ client_id: candidate.client_id, sent: false, reason: err.message });
    }
  }
  return results;
}

module.exports = { runNudgeJob };
