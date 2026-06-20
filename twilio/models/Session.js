const mongoose = require("mongoose");

const SessionSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, unique: true },
    stage: {
      type: String,
      enum: ["idle", "awaiting_confirmation"],
      default: "idle",
    },
    language: { type: String, enum: ["hi", "en", "mr"], default: "hi" },
    pendingExtraction: { type: mongoose.Schema.Types.Mixed, default: null },
    confirmedInvoiceCount: { type: Number, default: 0 },
    has2B: { type: Boolean, default: false },
    lastMismatches: { type: [mongoose.Schema.Types.Mixed], default: [] },
  },
  { timestamps: true }
);

const Session = mongoose.model("Session", SessionSchema);

module.exports = { Session };
