const mongoose = require("mongoose");

const SessionSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, unique: true },
    stage: {
      type: String,
      enum: ["idle", "awaiting_confirmation", "reviewing_batch", "awaiting_media_type"],
      default: "idle",
    },
    language: { type: String, enum: ["hi", "en", "mr"], default: "hi" },
    pendingExtraction: { type: mongoose.Schema.Types.Mixed, default: null },
    confirmedInvoiceCount: { type: Number, default: 0 },
    has2B: { type: Boolean, default: false },
    lastMismatches: { type: [mongoose.Schema.Types.Mixed], default: [] },
    // Batch invoice intake (multiple bills sent at once, or sent in quick
    // succession before the previous one was confirmed).
    reviewQueue: { type: [mongoose.Schema.Types.Mixed], default: [] },
    batchSaved: { type: Number, default: 0 },
    batchFailed: { type: Number, default: 0 },
    // Set while we've asked "is this a bill or your GSTR-2B?" for an
    // ambiguous PDF, holding the media until the trader answers.
    pendingMedia: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

const Session = mongoose.model("Session", SessionSchema);

module.exports = { Session };
