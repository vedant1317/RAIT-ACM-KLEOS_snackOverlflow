const Groq = require("groq-sdk");
const { toFile } = require("groq-sdk/uploads");

let _client = null;
function client() {
  if (!_client) {
    _client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return _client;
}

const INTENT_MODEL = process.env.GROQ_INTENT_MODEL || "llama-3.3-70b-versatile";
const TRANSCRIPTION_MODEL = process.env.GROQ_TRANSCRIPTION_MODEL || "whisper-large-v3";

const FIELDS = [
  "vendor_name",
  "vendor_gstin",
  "invoice_number",
  "invoice_date",
  "taxable_value",
  "gst_rate",
  "gst_amount",
  "hsn_code",
];

const SYSTEM_PROMPT = `You parse a trader's free-text WhatsApp reply about a GST invoice
or bot command. The message may be in English, Hindi, Marathi, Hinglish, or
Marathi written in Latin script. Classify the reply into exactly one intent:
- "confirm": trader accepts the extracted fields as-is (e.g. "ok", "sahi hai", "yes", "theek hai", "barobar aahe", "ठीक आहे")
- "correction": trader is correcting one or more fields (e.g. "GSTIN galat hai, sahi hai 27AAA...", "GST amount 4200 kara")
- "reconcile": trader wants to run reconciliation/check now (e.g. "check", "reconcile", "milaan karo", "तपासा", "जुळवा")
- "language_en": trader wants English (e.g. "english", "speak in English")
- "language_hi": trader wants Hindi (e.g. "hindi", "हिंदी", "Hindi mein bolo")
- "language_mr": trader wants Marathi (e.g. "marathi", "मराठी", "Marathi madhe bola")
- "menu": trader wants the main menu / help / greeting (e.g. "hi", "menu", "help", "namaste", "नमस्कार")
- "question": trader is asking a question about their own GST/ITC situation rather than giving a command
  (e.g. "kitna paisa atka hai?", "ABC supplier ne file kiya?", "kaunsa bill chase karna hai?", "why is my ITC low?")
- "unknown": anything that doesn't clearly fit

If the intent is "correction", also extract a "corrections" object containing
only the fields the trader is changing, using exactly these field names:
${FIELDS.join(", ")}.

Respond ONLY with compact JSON: {"intent": "...", "corrections": {...}}`;

async function parseIntent(text) {
  const response = await client().chat.completions.create({
    model: INTENT_MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: text },
    ],
    temperature: 0,
    response_format: { type: "json_object" },
  });
  const raw = response.choices[0].message.content;
  try {
    const parsed = JSON.parse(raw);
    return {
      intent: parsed.intent || "unknown",
      corrections: parsed.corrections || {},
    };
  } catch {
    return { intent: "unknown", corrections: {} };
  }
}

async function transcribeAudio(buffer, filename, contentType, language) {
  const languageHint = ["en", "hi", "mr"].includes(language) ? language : undefined;
  const file = await toFile(buffer, filename, { type: contentType });
  const response = await client().audio.transcriptions.create({
    file,
    model: TRANSCRIPTION_MODEL,
    language: languageHint,
    prompt:
      "GST assistant WhatsApp voice note. The user may say invoice, bill, GSTR-2B, check, reconcile, OK, correction, Hindi, Marathi, or English.",
    response_format: "json",
    temperature: 0,
  });
  return (response.text || "").trim();
}

const LANGUAGE_NAMES = { en: "English", hi: "Hindi", mr: "Marathi" };

/**
 * "Ask Munshi" Q&A — answers a free-text question using ONLY the supplied
 * structured facts (the trader's own already-computed reconciliation
 * context). The model never recalculates a rupee figure; if the facts don't
 * cover the question it should say so rather than guessing.
 */
async function answerQuestion(question, context, language = "hi") {
  const languageName = LANGUAGE_NAMES[language] || "Hindi";
  const systemPrompt =
    `You are Munshi, a GST assistant for a small Indian trader, answering on WhatsApp in ${languageName}. ` +
    "You are given JSON facts already computed by a deterministic reconciliation engine — vendor names, " +
    "invoice numbers, rupee amounts, issue types, recommendations. Answer the trader's question using ONLY " +
    "these facts. Never invent or recalculate a rupee figure. If the facts don't contain what's being asked, " +
    "say plainly that you don't have that information yet and suggest sending bills/GSTR-2B or typing 'check'. " +
    "Keep the answer short — 2-4 sentences, shopkeeper-friendly, no jargon.";

  try {
    const response = await client().chat.completions.create({
      model: INTENT_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Facts: ${JSON.stringify(context)}\n\nQuestion: ${question}` },
      ],
      temperature: 0.2,
    });
    return response.choices[0].message.content.trim();
  } catch {
    return null;
  }
}

/**
 * Optional politeness pass over a deterministic supplier-message draft.
 * Falls back to the draft unchanged if Groq is unavailable — the message
 * is always forwardable even without this step.
 */
async function polishSupplierMessage(draft, language = "en") {
  const languageName = LANGUAGE_NAMES[language] || "English";
  try {
    const response = await client().chat.completions.create({
      model: INTENT_MODEL,
      messages: [
        {
          role: "system",
          content:
            `Rewrite this GST-supplier follow-up message in polite, natural ${languageName}. ` +
            "Keep every number, invoice number, and vendor name exactly as given. Keep it short — 2-4 sentences.",
        },
        { role: "user", content: draft },
      ],
      temperature: 0.3,
    });
    return response.choices[0].message.content.trim();
  } catch {
    return draft;
  }
}

module.exports = { parseIntent, transcribeAudio, answerQuestion, polishSupplierMessage };
