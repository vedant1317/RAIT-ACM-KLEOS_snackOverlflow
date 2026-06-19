const { Session } = require("../models/Session");

async function getOrCreateSession(phone) {
  let session = await Session.findOne({ phone });
  if (!session) {
    session = await Session.create({ phone });
  }
  return session;
}

async function setStage(phone, stage, extra = {}) {
  return Session.findOneAndUpdate(
    { phone },
    { $set: { stage, ...extra } },
    { new: true, upsert: true }
  );
}

async function setLanguage(phone, language) {
  return Session.findOneAndUpdate({ phone }, { $set: { language } }, { new: true, upsert: true });
}

async function setPendingExtraction(phone, extraction) {
  return setStage(phone, "awaiting_confirmation", { pendingExtraction: extraction });
}

async function clearPendingExtraction(phone) {
  return setStage(phone, "idle", { pendingExtraction: null });
}

async function incrementInvoiceCount(phone) {
  return Session.findOneAndUpdate(
    { phone },
    { $inc: { confirmedInvoiceCount: 1 } },
    { new: true, upsert: true }
  );
}

async function markBaselineUploaded(phone) {
  return Session.findOneAndUpdate({ phone }, { $set: { has2B: true } }, { new: true, upsert: true });
}

async function setLastMismatches(phone, mismatches) {
  return Session.findOneAndUpdate({ phone }, { $set: { lastMismatches: mismatches } }, { new: true, upsert: true });
}

module.exports = {
  getOrCreateSession,
  setStage,
  setLanguage,
  setPendingExtraction,
  clearPendingExtraction,
  incrementInvoiceCount,
  markBaselineUploaded,
  setLastMismatches,
};
