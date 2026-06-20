const crypto = require("crypto");
const Groq = require("groq-sdk");

// Spoken WhatsApp replies for low-literacy users. Optional final layer —
// text stays canonical; this only ever runs when ENABLE_TTS=true, and any
// failure here is swallowed so it can never block or break a text reply.
// Uses Groq's own TTS models (PlayAI) since GROQ_API_KEY is already
// configured — no extra provider/credential needed.

const TTS_MODEL = process.env.GROQ_TTS_MODEL || "playai-tts";
const TTS_VOICE = process.env.GROQ_TTS_VOICE || "Fritz-PlayAI";
const MAX_SPOKEN_CHARS = 400; // keep voice notes short — a summary, not the full text
const CACHE_TTL_MS = 10 * 60 * 1000;

let _client = null;
function client() {
  if (!_client) {
    _client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return _client;
}

const _mediaCache = new Map(); // id -> { buffer, contentType, expiresAt }

function isEnabled() {
  return String(process.env.ENABLE_TTS || "false").toLowerCase() === "true";
}

function publicBaseUrl() {
  return process.env.NGROK_URL || "";
}

function shortenForSpeech(text) {
  const firstParagraph = text.split("\n\n")[0] || text;
  return firstParagraph.length > MAX_SPOKEN_CHARS ? `${firstParagraph.slice(0, MAX_SPOKEN_CHARS)}...` : firstParagraph;
}

function cacheMedia(buffer, contentType) {
  const id = crypto.randomBytes(8).toString("hex");
  _mediaCache.set(id, { buffer, contentType, expiresAt: Date.now() + CACHE_TTL_MS });
  setTimeout(() => _mediaCache.delete(id), CACHE_TTL_MS).unref?.();
  return id;
}

function getCachedMedia(id) {
  const entry = _mediaCache.get(id);
  if (!entry || entry.expiresAt < Date.now()) return null;
  return entry;
}

function getCachedAudio(id) {
  return getCachedMedia(id);
}

async function generateSpeech(text) {
  const response = await client().audio.speech.create({
    model: TTS_MODEL,
    voice: TTS_VOICE,
    input: shortenForSpeech(text),
    response_format: "wav",
  });
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Best-effort: generate a short spoken summary and send it as WhatsApp
 * media, if ENABLE_TTS is on and a public base URL is configured to host
 * the generated clip. Never throws — callers should still treat the text
 * message as the canonical reply.
 */
async function maybeSendVoiceReply(to, text, _language) {
  if (!isEnabled()) return;
  const baseUrl = publicBaseUrl();
  if (!baseUrl) {
    console.warn("[voiceReply] ENABLE_TTS is true but NGROK_URL is not set — skipping voice reply.");
    return;
  }

  const buffer = await generateSpeech(text);
  const id = cacheMedia(buffer, "audio/wav");

  const twilio = require("twilio");
  const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  await twilioClient.messages.create({
    from: process.env.TWILIO_WHATSAPP_NUMBER,
    to,
    mediaUrl: [`${baseUrl}/media/${id}.wav`],
  });
}

module.exports = { maybeSendVoiceReply, getCachedAudio, getCachedMedia, cacheMedia, isEnabled };
