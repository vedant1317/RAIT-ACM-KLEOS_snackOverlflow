const express = require("express");
const twilio = require("twilio");

const {
  getOrCreateSession,
  setLanguage,
  setPendingExtraction,
  clearPendingExtraction,
  incrementInvoiceCount,
  markBaselineUploaded,
  setLastMismatches,
} = require("../services/messageState");
const { downloadMedia } = require("../services/twilioMedia");
const backendClient = require("../services/backendClient");
const groqService = require("../services/groqService");
const contentBuilder = require("../services/contentBuilder");
const { t, formatReconciliationResult, formatMismatchDetail } = require("../services/replyFormatter");

const router = express.Router();
const { MessagingResponse } = twilio.twiml;

const IMAGE_PDF_TYPES = new Set(["image/jpeg", "image/png", "image/jpg", "application/pdf"]);
const SPREADSHEET_TYPES = new Set([
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);
const AUDIO_PREFIXES = ["audio/"];
const BACKEND_LANGUAGE = { en: "English", hi: "Hindi", mr: "Marathi" };

function twilioClient() {
  return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

async function sendMessage(to, body) {
  await twilioClient().messages.create({
    from: process.env.TWILIO_WHATSAPP_NUMBER,
    to,
    body,
  });
}

const LANGUAGE_OF = {
  english: "en",
  angrezi: "en",
  इंग्रजी: "en",
  hindi: "hi",
  हिन्दी: "hi",
  हिंदी: "hi",
  marathi: "mr",
  मराठी: "mr",
  marathi_madhe: "mr",
};
const GREETING_WORDS = new Set([
  "hi",
  "hello",
  "hey",
  "menu",
  "help",
  "namaste",
  "start",
  "नमस्ते",
  "नमस्कार",
]);
const RECONCILE_WORDS = new Set([
  "check",
  "reconcile",
  "milaan karo",
  "milan karo",
  "जुळवा",
  "जुळवणी करा",
  "तपासा",
  "तपास",
  "तपासून बघा",
]);
const CONFIRM_WORDS = new Set([
  "ok",
  "okay",
  "yes",
  "sahi hai",
  "theek hai",
  "haan",
  "barobar",
  "barobar aahe",
  "ठीक आहे",
  "बरोबर आहे",
  "हो",
]);

function normalise(text) {
  return (text || "")
    .trim()
    .toLocaleLowerCase("en-IN")
    .replace(/[?.,!'"`]/g, "")
    .replace(/\s+/g, " ");
}

function isAudioType(contentType = "") {
  return AUDIO_PREFIXES.some((prefix) => contentType.toLowerCase().startsWith(prefix));
}

function audioFilename(contentType = "") {
  if (contentType.includes("mpeg") || contentType.includes("mp3")) return "voice.mp3";
  if (contentType.includes("mp4") || contentType.includes("m4a")) return "voice.m4a";
  if (contentType.includes("wav")) return "voice.wav";
  if (contentType.includes("webm")) return "voice.webm";
  return "voice.ogg";
}

function directLanguage(lower) {
  if (LANGUAGE_OF[lower]) return LANGUAGE_OF[lower];
  if (lower.includes("english") || lower.includes("angrezi") || lower.includes("इंग्रजी")) return "en";
  if (lower.includes("hindi") || lower.includes("हिंदी") || lower.includes("हिन्दी")) return "hi";
  if (lower.includes("marathi") || lower.includes("मराठी")) return "mr";
  return null;
}

function languageFromIntent(intent) {
  if (intent === "language_en") return "en";
  if (intent === "language_hi") return "hi";
  if (intent === "language_mr") return "mr";
  return null;
}

router.post("/sms", async (req, res) => {
  const from = req.body.From;
  const body = (req.body.Body || "").trim();
  const numMedia = parseInt(req.body.NumMedia || "0", 10);

  const twiml = new MessagingResponse();
  const session = await getOrCreateSession(from);
  const language = session.language;

  try {
    if (numMedia > 0) {
      const mediaUrl = req.body.MediaUrl0;
      const contentType = req.body.MediaContentType0;

      if (IMAGE_PDF_TYPES.has(contentType)) {
        twiml.message(t(language).processing);
        res.type("text/xml").send(twiml.toString());
        handleInvoiceMedia(from, language, mediaUrl, contentType).catch((err) =>
          console.error("[sms] invoice handling failed:", err.message)
        );
        return;
      }

      if (SPREADSHEET_TYPES.has(contentType)) {
        twiml.message(t(language).processingBaseline);
        res.type("text/xml").send(twiml.toString());
        handleBaselineMedia(from, language, mediaUrl, contentType).catch((err) =>
          console.error("[sms] baseline handling failed:", err.message)
        );
        return;
      }

      if (isAudioType(contentType)) {
        twiml.message(t(language).processingVoice);
        res.type("text/xml").send(twiml.toString());
        handleVoiceMedia(from, session, mediaUrl, contentType).catch((err) =>
          console.error("[sms] voice handling failed:", err.message)
        );
        return;
      }

      twiml.message(t(language).unknown);
      return res.type("text/xml").send(twiml.toString());
    }

    const action = await buildTextAction(from, session, body);
    twiml.message(action.reply);
    res.type("text/xml").send(twiml.toString());
    if (action.after) action.after().catch((err) => console.error("[sms] async action failed:", err.message));
    return;
  } catch (err) {
    console.error("[sms] handler error:", err);
    twiml.message(t(language).unknown);
    return res.type("text/xml").send(twiml.toString());
  }
});

async function buildTextAction(from, session, body) {
  const language = session.language || "hi";
  const lower = normalise(body);

  const requestedLanguage = directLanguage(lower);
  if (requestedLanguage) {
    await setLanguage(from, requestedLanguage);
    return { reply: `${t(requestedLanguage).languageSwitched}\n\n${t(requestedLanguage).menu}` };
  }

  if (GREETING_WORDS.has(lower)) {
    return { reply: t(language).menu };
  }

  // Tapping a row in the reconciliation List Picker sends the row's id
  // (the invoice number) back as a plain inbound message — match it
  // against the last result and reply with that bill's full detail.
  if (session.lastMismatches && session.lastMismatches.length > 0) {
    const tapped = session.lastMismatches.find(
      (m) => normalise(m.invoice_number) === lower || m.invoice_number === body.trim()
    );
    if (tapped) {
      return { reply: formatMismatchDetail(tapped, language) };
    }
  }

  let intent = null;
  let corrections = {};

  if (RECONCILE_WORDS.has(lower)) intent = "reconcile";
  else if (session.stage === "awaiting_confirmation" && CONFIRM_WORDS.has(lower)) intent = "confirm";

  if (!intent) {
    const parsed = await groqService.parseIntent(body);
    intent = parsed.intent;
    corrections = parsed.corrections;
  }

  const intentLanguage = languageFromIntent(intent);
  if (intentLanguage) {
    await setLanguage(from, intentLanguage);
    return { reply: `${t(intentLanguage).languageSwitched}\n\n${t(intentLanguage).menu}` };
  }

  if (intent === "menu") {
    return { reply: t(language).menu };
  }

  if (intent === "reconcile") {
    if (session.confirmedInvoiceCount === 0) {
      return { reply: t(language).needInvoicesBeforeCheck };
    }
    if (!session.has2B) {
      return { reply: t(language).needBaselineBeforeCheck };
    }
    return {
      reply: t(language).reconciling,
      after: () => handleReconcile(from, language),
    };
  }

  if (session.stage === "awaiting_confirmation") {
    return { reply: await handleConfirmationIntent(from, language, session, intent, corrections) };
  }

  return { reply: t(language).unknown };
}

async function handleInvoiceMedia(from, language, mediaUrl, contentType) {
  try {
    const { buffer } = await downloadMedia(mediaUrl);
    const filename = contentType === "application/pdf" ? "invoice.pdf" : "invoice.jpg";
    const extracted = await backendClient.extractInvoice(buffer, filename, contentType);
    await setPendingExtraction(from, extracted);
    await sendMessage(from, t(language).confirmInvoice(extracted));
  } catch (err) {
    console.error("[invoice] extraction failed:", err.message);
    await sendMessage(from, t(language).extractionFailed);
  }
}

async function handleBaselineMedia(from, language, mediaUrl, contentType) {
  try {
    const { buffer } = await downloadMedia(mediaUrl);
    const filename = contentType.includes("csv") ? "gstr2b.csv" : "gstr2b.xlsx";
    const result = await backendClient.uploadBaseline(from, buffer, filename, contentType);
    await markBaselineUploaded(from);
    await sendMessage(from, t(language).baselineUploaded(result.rows_loaded));
  } catch (err) {
    console.error("[baseline] upload failed:", err.message);
    await sendMessage(from, t(language).baselineFailed);
  }
}

async function handleVoiceMedia(from, session, mediaUrl, contentType) {
  const language = session.language || "hi";
  let transcript;
  try {
    const { buffer } = await downloadMedia(mediaUrl);
    transcript = await groqService.transcribeAudio(buffer, audioFilename(contentType), contentType, language);
  } catch (err) {
    console.error("[voice] transcription failed:", err.message);
    await sendMessage(from, t(language).voiceFailed);
    return;
  }

  if (!transcript) {
    await sendMessage(from, t(language).voiceFailed);
    return;
  }

  const freshSession = await getOrCreateSession(from);
  const action = await buildTextAction(from, freshSession, transcript);
  await sendMessage(from, action.reply);
  if (action.after) await action.after();
}

async function handleConfirmationIntent(from, language, session, intent, corrections) {
  if (intent === "confirm") {
    await backendClient.confirmInvoice(from, session.pendingExtraction);
    await clearPendingExtraction(from);
    const updated = await incrementInvoiceCount(from);
    return t(language).invoiceConfirmed(updated.confirmedInvoiceCount);
  }

  if (intent === "correction" && Object.keys(corrections).length > 0) {
    const merged = { ...session.pendingExtraction, ...corrections };
    await setPendingExtraction(from, merged);
    return `${t(language).correctionApplied}\n\n${t(language).confirmInvoice(merged)}`;
  }

  return t(language).unknown;
}

async function handleReconcile(from, language) {
  let result;
  try {
    result = await backendClient.runReconciliation(from, BACKEND_LANGUAGE[language] || "Hindi");
  } catch (err) {
    console.error("[reconcile] backend call failed:", err.message);
    await sendMessage(from, t(language).unknown);
    return;
  }

  await setLastMismatches(from, result.explanations);

  if (result.explanations.length === 0) {
    await sendMessage(from, formatReconciliationResult(result, language));
    return;
  }

  try {
    const contentSid = await contentBuilder.createMismatchListContent(result.headline, result.explanations, language);
    await twilioClient().messages.create({
      from: process.env.TWILIO_WHATSAPP_NUMBER,
      to: from,
      contentSid,
    });
  } catch (err) {
    console.error("[reconcile] list-picker send failed, falling back to plain text:", err.message);
    await sendMessage(from, formatReconciliationResult(result, language));
  }
}

module.exports = router;
