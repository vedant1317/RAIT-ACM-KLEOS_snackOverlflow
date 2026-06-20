require("dotenv").config();

const express = require("express");
const { connectDb } = require("./config/db");
const smsRouter = require("./routes/sms");
const nudgeService = require("./services/nudgeService");
const voiceReplyService = require("./services/voiceReplyService");

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.get("/health", (req, res) => res.json({ status: "ok" }));
app.use("/", smsRouter);

// Generated TTS clips (see voiceReplyService.js) are served briefly from
// memory here so Twilio's mediaUrl can fetch them over the public ngrok URL.
app.get("/media/:id.:ext", (req, res) => {
  const entry = voiceReplyService.getCachedMedia(req.params.id);
  if (!entry) return res.status(404).end();
  res.set("Content-Type", entry.contentType);
  res.send(entry.buffer);
});

// Proactive monthly recovery nudges (see services/nudgeService.js). Protected
// by a shared secret since this is business-initiated, not a Twilio webhook.
app.post("/nudge", async (req, res) => {
  const provided = req.header("X-Nudge-Secret") || req.query.secret;
  if (!process.env.NUDGE_SECRET || provided !== process.env.NUDGE_SECRET) {
    return res.status(401).json({ error: "Invalid or missing nudge secret" });
  }
  try {
    const results = await nudgeService.runNudgeJob();
    res.json({ ran: true, results });
  } catch (err) {
    console.error("[nudge] job failed:", err.message);
    res.status(502).json({ ran: false, error: err.message });
  }
});

const PORT = process.env.PORT || 3002;

connectDb()
  .then(() => {
    app.listen(PORT, () => console.log(`[server] Munshi WhatsApp bot listening on port ${PORT}`));
  })
  .catch((err) => {
    console.error("[server] failed to connect to MongoDB:", err.message);
    process.exit(1);
  });
