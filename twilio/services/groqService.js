const Groq = require("groq-sdk");

let _client = null;
function client() {
  if (!_client) {
    _client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return _client;
}

const INTENT_MODEL = process.env.GROQ_INTENT_MODEL || "llama-3.3-70b-versatile";

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
they were just shown for review. Classify the reply into exactly one intent:
- "confirm": trader accepts the extracted fields as-is (e.g. "ok", "sahi hai", "yes", "theek hai")
- "correction": trader is correcting one or more fields (e.g. "GSTIN galat hai, sahi hai 27AAA...")
- "reconcile": trader wants to run reconciliation/check now (e.g. "check", "reconcile", "milaan karo")
- "language_en": trader wants English (e.g. "english")
- "language_hi": trader wants Hindi (e.g. "hindi")
- "menu": trader wants the main menu / help / greeting (e.g. "hi", "menu", "help")
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

module.exports = { parseIntent };
