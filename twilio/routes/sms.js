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
  startReviewQueue,
  advanceReviewQueue,
  setPendingMedia,
  clearPendingMedia,
} = require("../services/messageState");
const { downloadMedia } = require("../services/twilioMedia");
const backendClient = require("../services/backendClient");
const groqService = require("../services/groqService");
const contentBuilder = require("../services/contentBuilder");
const voiceReplyService = require("../services/voiceReplyService");
const {
  t,
  formatReconciliationResult,
  formatMismatchDetail,
  formatConfirmPrompt,
  formatStatusCard,
  formatRemindDraft,
} = require("../services/replyFormatter");

const router = express.Router();
const { MessagingResponse } = twilio.twiml;

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/jpg"]);
const PDF_TYPE = "application/pdf";
const MAX_WHATSAPP_BODY_CHARS = 1500;
const IMAGE_PDF_TYPES = new Set([...IMAGE_TYPES, PDF_TYPE]);
const SPREADSHEET_TYPES = new Set([
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);
const AUDIO_PREFIXES = ["audio/"];
const BACKEND_LANGUAGE = { en: "English", hi: "Hindi", mr: "Marathi" };

function maskPhone(phone = "") {
  const digits = String(phone).replace(/\D/g, "");
  if (digits.length <= 4) return "*".repeat(digits.length);
  return `${"*".repeat(digits.length - 4)}${digits.slice(-4)}`;
}

function twilioClient() {
  return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

function splitMessageBody(body, maxLength = MAX_WHATSAPP_BODY_CHARS) {
  const text = String(body || "");
  if (text.length <= maxLength) return [text];

  const chunks = [];
  let remaining = text.trim();
  while (remaining.length > maxLength) {
    let cut = remaining.lastIndexOf("\n\n", maxLength);
    if (cut < Math.floor(maxLength * 0.6)) cut = remaining.lastIndexOf("\n", maxLength);
    if (cut < Math.floor(maxLength * 0.6)) cut = remaining.lastIndexOf(" ", maxLength);
    if (cut < Math.floor(maxLength * 0.6)) cut = maxLength;

    chunks.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

async function sendMessage(to, body, language) {
  const chunks = splitMessageBody(body);
  const client = twilioClient();
  for (let i = 0; i < chunks.length; i += 1) {
    const prefix = chunks.length > 1 ? `(${i + 1}/${chunks.length}) ` : "";
    await client.messages.create({
      from: process.env.TWILIO_WHATSAPP_NUMBER,
      to,
      body: `${prefix}${chunks[i]}`,
    });
  }
  // Voice output is a best-effort extra layer behind ENABLE_TTS. For chunked
  // replies, speak only the first chunk so fallback text remains readable
  // without multiplying outbound media messages.
  voiceReplyService.maybeSendVoiceReply(to, chunks[0], language).catch((err) => {
    console.error("[sms] voice reply failed for", maskPhone(to), ":", err.message);
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
const STATUS_WORDS = new Set(["status", "sthiti", "halat", "स्थिति", "स्टेटस"]);
const REPORT_WORDS = new Set(["report", "pdf", "monthly report", "gst report", "रिपोर्ट", "पीडीएफ"]);
const MEDIA_TYPE_BILL_WORDS = new Set(["bill", "invoice", "1", "bil", "बिल"]);
const MEDIA_TYPE_2B_WORDS = new Set(["gstr2b", "2b", "2", "baseline", "gstr-2b"]);
const REMIND_PATTERN = /^remind\s+(.+)$/i;

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

function invoiceFilename(contentType) {
  return contentType === PDF_TYPE ? "invoice.pdf" : "invoice.jpg";
}

router.post("/sms", async (req, res) => {
  const from = req.body.From;
  const body = (req.body.Body || "").trim();
  const numMedia = parseInt(req.body.NumMedia || "0", 10);

  const twiml = new MessagingResponse();
  const session = await getOrCreateSession(from);
  const language = session.language;

  try {
    if (numMedia > 1) {
      const items = [];
      for (let i = 0; i < numMedia; i += 1) {
        const url = req.body[`MediaUrl${i}`];
        const contentType = req.body[`MediaContentType${i}`];
        if (url && IMAGE_PDF_TYPES.has(contentType)) items.push({ url, contentType });
      }
      if (items.length > 0) {
        twiml.message(t(language).processing);
        res.type("text/xml").send(twiml.toString());
        handleInvoiceBatch(from, language, items).catch((err) =>
          console.error("[sms] batch handling failed for", maskPhone(from), ":", err.message)
        );
        return;
      }
    }

    if (numMedia > 0) {
      const mediaUrl = req.body.MediaUrl0;
      const contentType = req.body.MediaContentType0;

      if (contentType === PDF_TYPE) {
        await setPendingMedia(from, { mediaUrl, contentType });
        twiml.message(t(language).mediaTypeQuestion);
        return res.type("text/xml").send(twiml.toString());
      }

      if (IMAGE_TYPES.has(contentType)) {
        twiml.message(t(language).processing);
        res.type("text/xml").send(twiml.toString());
        handleInvoiceMedia(from, language, mediaUrl, contentType).catch((err) =>
          console.error("[sms] invoice handling failed for", maskPhone(from), ":", err.message)
        );
        return;
      }

      if (SPREADSHEET_TYPES.has(contentType)) {
        twiml.message(t(language).processingBaseline);
        res.type("text/xml").send(twiml.toString());
        handleBaselineMedia(from, language, mediaUrl, contentType).catch((err) =>
          console.error("[sms] baseline handling failed for", maskPhone(from), ":", err.message)
        );
        return;
      }

      if (isAudioType(contentType)) {
        twiml.message(t(language).processingVoice);
        res.type("text/xml").send(twiml.toString());
        handleVoiceMedia(from, session, mediaUrl, contentType).catch((err) =>
          console.error("[sms] voice handling failed for", maskPhone(from), ":", err.message)
        );
        return;
      }

      twiml.message(t(language).unknown);
      return res.type("text/xml").send(twiml.toString());
    }

    const action = await buildTextAction(from, session, body);
    twiml.message(action.reply);
    res.type("text/xml").send(twiml.toString());
    if (action.after) action.after().catch((err) => console.error("[sms] async action failed for", maskPhone(from), ":", err.message));
    return;
  } catch (err) {
    console.error("[sms] handler error for", maskPhone(from), ":", err);
    twiml.message(t(language).unknown);
    return res.type("text/xml").send(twiml.toString());
  }
});

async function buildTextAction(from, session, body) {
  const language = session.language || "hi";
  const lower = normalise(body);

  // Answering "is this a bill or your GSTR-2B?" for a pending PDF takes
  // priority over every other text route.
  if (session.stage === "awaiting_media_type" && session.pendingMedia) {
    const { mediaUrl, contentType } = session.pendingMedia;
    if (MEDIA_TYPE_BILL_WORDS.has(lower)) {
      await clearPendingMedia(from);
      return {
        reply: t(language).processing,
        after: () => handleInvoiceMedia(from, language, mediaUrl, contentType),
      };
    }
    if (MEDIA_TYPE_2B_WORDS.has(lower)) {
      await clearPendingMedia(from);
      return {
        reply: t(language).processingBaseline,
        after: () => handleBaselineMedia(from, language, mediaUrl, contentType),
      };
    }
    return { reply: t(language).mediaTypeUnclear };
  }

  const requestedLanguage = directLanguage(lower);
  if (requestedLanguage) {
    await setLanguage(from, requestedLanguage);
    return { reply: `${t(requestedLanguage).languageSwitched}\n\n${t(requestedLanguage).menu}` };
  }

  if (GREETING_WORDS.has(lower)) {
    return { reply: t(language).menu };
  }

  if (STATUS_WORDS.has(lower)) {
    return { reply: await buildStatusReply(from, language) };
  }

  if (REPORT_WORDS.has(lower)) {
    return {
      reply: t(language).reportGenerating,
      after: () => sendPdfReport(from, language),
    };
  }

  const remindMatch = body.trim().match(REMIND_PATTERN);
  if (remindMatch) {
    return { reply: await buildRemindReply(from, session, language, remindMatch[1].trim()) };
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
  else if ((session.stage === "awaiting_confirmation" || session.stage === "reviewing_batch") && CONFIRM_WORDS.has(lower))
    intent = "confirm";

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

  if (session.stage === "awaiting_confirmation" || session.stage === "reviewing_batch") {
    return { reply: await handleConfirmationIntent(from, language, session, intent, corrections) };
  }

  if (intent === "question") {
    return { reply: await buildAnswerReply(from, language, body) };
  }

  return { reply: t(language).unknown };
}

async function extractOne(mediaUrl, contentType) {
  const { buffer } = await downloadMedia(mediaUrl);
  const filename = invoiceFilename(contentType);
  return backendClient.extractInvoice(buffer, filename, contentType);
}

async function handleInvoiceMedia(from, language, mediaUrl, contentType) {
  let extracted;
  try {
    extracted = await extractOne(mediaUrl, contentType);
  } catch (err) {
    console.error("[invoice] extraction failed:", err.message);
    await sendMessage(from, t(language).extractionFailed, language);
    return;
  }

  const fresh = await getOrCreateSession(from);

  // Sequential media: a bill arrived while another was already pending
  // (single-flow) or mid-review (batch flow) — never silently drop it.
  if (fresh.stage === "awaiting_confirmation" && fresh.pendingExtraction) {
    await resolvePendingBeforeReplacing(from, fresh.pendingExtraction);
  } else if (fresh.stage === "reviewing_batch" && fresh.pendingExtraction) {
    if (!extracted.needs_review) {
      await backendClient.confirmInvoice(from, extracted);
      await incrementInvoiceCount(from);
      await sendMessage(from, t(language).invoiceAutoSaved((await getOrCreateSession(from)).confirmedInvoiceCount), language);
    } else {
      const updated = await getOrCreateSession(from);
      await startReviewQueue(from, [...updated.reviewQueue, extracted]);
      await sendMessage(from, t(language).queueAdded(updated.reviewQueue.length + 1), language);
    }
    return;
  }

  if (!extracted.needs_review) {
    await backendClient.confirmInvoice(from, extracted);
    const updated = await incrementInvoiceCount(from);
    await sendMessage(from, t(language).invoiceAutoSaved(updated.confirmedInvoiceCount), language);
    return;
  }

  await setPendingExtraction(from, extracted);
  await sendMessage(from, formatConfirmPrompt(extracted, language), language);
}

async function resolvePendingBeforeReplacing(from, pending) {
  if (!pending.needs_review) {
    await backendClient.confirmInvoice(from, pending);
    await incrementInvoiceCount(from);
  } else {
    await startReviewQueue(from, [pending]);
  }
}

async function handleInvoiceBatch(from, language, items) {
  let extractions;
  try {
    extractions = await Promise.all(items.map((item) => extractOne(item.url, item.contentType)));
  } catch (err) {
    console.error("[invoice] batch extraction failed:", err.message);
    await sendMessage(from, t(language).extractionFailed, language);
    return;
  }

  const highConfidence = extractions.filter((e) => !e.needs_review);
  const lowConfidence = extractions.filter((e) => e.needs_review);

  let saved = 0;
  if (highConfidence.length > 0) {
    try {
      const result = await backendClient.confirmBatch(from, highConfidence);
      saved = result.saved || highConfidence.length;
    } catch (err) {
      console.error("[invoice] confirm-batch failed:", err.message);
    }
  }

  await startReviewQueue(from, lowConfidence, { saved });
  await sendMessage(from, t(language).batchSummary(saved, lowConfidence.length), language);
  if (lowConfidence.length > 0) {
    await sendMessage(from, formatConfirmPrompt(lowConfidence[0], language), language);
  }
}

async function handleBaselineMedia(from, language, mediaUrl, contentType) {
  try {
    const { buffer } = await downloadMedia(mediaUrl);
    const filename = contentType.includes("csv") ? "gstr2b.csv" : contentType === PDF_TYPE ? "gstr2b.pdf" : "gstr2b.xlsx";
    const result = await backendClient.uploadBaseline(from, buffer, filename, contentType);
    await markBaselineUploaded(from);
    await sendMessage(from, t(language).baselineUploaded(result.rows_loaded), language);
  } catch (err) {
    console.error("[baseline] upload failed:", err.message);
    await sendMessage(from, t(language).baselineFailed, language);
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
    await sendMessage(from, t(language).voiceFailed, language);
    return;
  }

  if (!transcript) {
    await sendMessage(from, t(language).voiceFailed, language);
    return;
  }

  const freshSession = await getOrCreateSession(from);
  const action = await buildTextAction(from, freshSession, transcript);
  await sendMessage(from, action.reply, language);
  if (action.after) await action.after();
}

async function handleConfirmationIntent(from, language, session, intent, corrections) {
  if (intent === "confirm") {
    await backendClient.confirmInvoice(from, session.pendingExtraction);
    const incremented = await incrementInvoiceCount(from);

    if (session.stage === "reviewing_batch") {
      const updated = await advanceReviewQueue(from);
      if (updated.pendingExtraction) {
        return `${t(language).invoiceConfirmed(incremented.confirmedInvoiceCount)}\n\n${formatConfirmPrompt(updated.pendingExtraction, language)}`;
      }
      return t(language).batchComplete(incremented.confirmedInvoiceCount);
    }

    await clearPendingExtraction(from);
    return t(language).invoiceConfirmed(incremented.confirmedInvoiceCount);
  }

  if (intent === "correction" && Object.keys(corrections).length > 0) {
    const merged = { ...session.pendingExtraction, ...corrections };
    await setPendingExtraction(from, merged);
    if (session.stage === "reviewing_batch") {
      // setPendingExtraction always moves stage to awaiting_confirmation;
      // pull it back into the batch so 'advanceReviewQueue' still applies.
      await startReviewQueue(from, [merged, ...session.reviewQueue.slice(1)]);
    }
    return `${t(language).correctionApplied}\n\n${formatConfirmPrompt(merged, language)}`;
  }

  return t(language).unknown;
}

async function handleReconcile(from, language) {
  let result;
  try {
    result = await backendClient.runReconciliation(from, BACKEND_LANGUAGE[language] || "Hindi");
  } catch (err) {
    console.error("[reconcile] backend call failed:", err.message);
    await sendMessage(from, t(language).unknown, language);
    return;
  }

  await setLastMismatches(from, result.explanations);

  if (result.explanations.length === 0) {
    await sendMessage(from, formatReconciliationResult(result, language), language);
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
    await sendMessage(from, formatReconciliationResult(result, language), language);
  }
}

async function buildStatusReply(from, language) {
  try {
    const summary = await backendClient.getTraderSummary(from);
    return formatStatusCard(summary, language);
  } catch (err) {
    console.error("[status] backend call failed:", err.message);
    return t(language).unknown;
  }
}

async function sendPdfReport(from, language) {
  const baseUrl = (process.env.NGROK_URL || "").replace(/\/$/, "");
  if (!baseUrl) {
    await sendMessage(from, t(language).reportNeedsPublicUrl, language);
    return;
  }

  let pdf;
  try {
    pdf = await backendClient.getTraderReport(from);
  } catch (err) {
    console.error("[report] backend call failed:", err.message);
    await sendMessage(from, t(language).reportFailed, language);
    return;
  }

  const mediaId = voiceReplyService.cacheMedia(pdf, "application/pdf");
  try {
    await twilioClient().messages.create({
      from: process.env.TWILIO_WHATSAPP_NUMBER,
      to: from,
      body: t(language).reportReady,
      mediaUrl: [`${baseUrl}/media/${mediaId}.pdf`],
    });
  } catch (err) {
    console.error("[report] media send failed:", err.message);
    await sendMessage(from, t(language).reportSendFailed, language);
  }
}

async function buildRemindReply(from, session, language, invoiceNumber) {
  const target = (session.lastMismatches || []).find(
    (m) => m.invoice_number.toLowerCase() === invoiceNumber.toLowerCase()
  );
  if (!target) {
    return t(language).remindNotFound(invoiceNumber);
  }
  const draft = buildDeterministicDraft(target, language);
  const polished = await groqService.polishSupplierMessage(draft, language);
  return formatRemindDraft(polished || draft, language);
}

function buildDeterministicDraft(mismatch, language) {
  const templates = {
    en: `Dear ${mismatch.vendor_name}, regarding invoice ${mismatch.invoice_number}: ${mismatch.text} This is affecting Rs.${mismatch.rupee_impact} of our input tax credit. Could you please look into this and let us know? Thank you.`,
    hi: `Namaste ${mismatch.vendor_name}, bill ${mismatch.invoice_number} ke baare mein: ${mismatch.text} Iski wajah se humara Rs.${mismatch.rupee_impact} ka ITC atka hua hai. Kripya ise dekh lein. Dhanyavaad.`,
    mr: `Namaskar ${mismatch.vendor_name}, bill ${mismatch.invoice_number} sambandhi: ${mismatch.text} Yamule amcha Rs.${mismatch.rupee_impact} cha ITC adkun rahila aahe. Kripaya he baghave. Dhanyavaad.`,
  };
  return templates[language] || templates.en;
}

async function buildAnswerReply(from, language, question) {
  try {
    const context = await backendClient.getTraderContext(from);
    if (!context.has_data) {
      return t(language).qnaNoData;
    }
    const answer = await groqService.answerQuestion(question, context, language);
    return answer || t(language).qnaNoData;
  } catch (err) {
    console.error("[qna] context fetch failed:", err.message);
    return t(language).qnaNoData;
  }
}

module.exports = router;
