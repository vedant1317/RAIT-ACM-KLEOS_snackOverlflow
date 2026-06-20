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

// --- batch invoice intake -------------------------------------------------
async function startReviewQueue(phone, queue, { saved = 0, failed = 0 } = {}) {
  const head = queue[0] || null;
  return Session.findOneAndUpdate(
    { phone },
    {
      $set: {
        stage: head ? "reviewing_batch" : "idle",
        reviewQueue: queue,
        pendingExtraction: head,
      },
      $inc: { batchSaved: saved, batchFailed: failed, confirmedInvoiceCount: saved },
    },
    { new: true, upsert: true }
  );
}

async function advanceReviewQueue(phone) {
  const session = await Session.findOne({ phone });
  if (!session) return null;
  const remaining = (session.reviewQueue || []).slice(1);
  const head = remaining[0] || null;
  return Session.findOneAndUpdate(
    { phone },
    {
      $set: {
        reviewQueue: remaining,
        pendingExtraction: head,
        stage: head ? "reviewing_batch" : "idle",
      },
    },
    { new: true, upsert: true }
  );
}

async function setPendingMedia(phone, media) {
  return setStage(phone, "awaiting_media_type", { pendingMedia: media });
}

async function clearPendingMedia(phone) {
  return Session.findOneAndUpdate({ phone }, { $set: { pendingMedia: null } }, { new: true, upsert: true });
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
  startReviewQueue,
  advanceReviewQueue,
  setPendingMedia,
  clearPendingMedia,
};
