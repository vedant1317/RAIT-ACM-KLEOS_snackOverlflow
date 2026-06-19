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

const LANGUAGE_OF = { english: "en", hindi: "hi" };
const GREETING_WORDS = new Set(["hi", "hello", "hey", "menu", "help", "namaste", "start"]);
const RECONCILE_WORDS = new Set(["check", "reconcile", "milaan karo", "milan karo"]);

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

      twiml.message(t(language).unknown);
      return res.type("text/xml").send(twiml.toString());
    }

    const lower = body.toLowerCase();

    if (GREETING_WORDS.has(lower)) {
      twiml.message(t(language).menu);
      return res.type("text/xml").send(twiml.toString());
    }

    if (lower in LANGUAGE_OF) {
      const newLanguage = LANGUAGE_OF[lower];
      await setLanguage(from, newLanguage);
      twiml.message(`${t(newLanguage).languageSwitched}\n\n${t(newLanguage).menu}`);
      return res.type("text/xml").send(twiml.toString());
    }

    // Tapping a row in the reconciliation List Picker sends the row's id
    // (the invoice number) back as a plain inbound message — match it
    // against the last result and reply with that bill's full detail.
    if (session.lastMismatches && session.lastMismatches.length > 0) {
      const tapped = session.lastMismatches.find((m) => m.invoice_number === body.trim());
      if (tapped) {
        twiml.message(formatMismatchDetail(tapped, language));
        return res.type("text/xml").send(twiml.toString());
      }
    }

    if (RECONCILE_WORDS.has(lower)) {
      if (session.confirmedInvoiceCount === 0) {
        twiml.message(t(language).needInvoicesBeforeCheck);
        return res.type("text/xml").send(twiml.toString());
      }
      if (!session.has2B) {
        twiml.message(t(language).needBaselineBeforeCheck);
        return res.type("text/xml").send(twiml.toString());
      }
      twiml.message(t(language).reconciling);
      res.type("text/xml").send(twiml.toString());
      handleReconcile(from, language).catch((err) => console.error("[sms] reconcile failed:", err.message));
      return;
    }

    if (session.stage === "awaiting_confirmation") {
      const reply = await handleConfirmationReply(from, language, session, body);
      twiml.message(reply);
      return res.type("text/xml").send(twiml.toString());
    }

    twiml.message(t(language).unknown);
    return res.type("text/xml").send(twiml.toString());
  } catch (err) {
    console.error("[sms] handler error:", err);
    twiml.message(t(language).unknown);
    return res.type("text/xml").send(twiml.toString());
  }
});

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

async function handleConfirmationReply(from, language, session, body) {
  const lower = body.toLowerCase();
  const looksLikeConfirm = ["ok", "okay", "yes", "sahi hai", "theek hai", "haan"].includes(lower);

  let intent = looksLikeConfirm ? "confirm" : null;
  let corrections = {};

  if (!intent) {
    const parsed = await groqService.parseIntent(body);
    intent = parsed.intent;
    corrections = parsed.corrections;
  }

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
    result = await backendClient.runReconciliation(from, language === "en" ? "English" : "Hindi");
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
