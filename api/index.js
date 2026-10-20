const VERSION = "v7-fast-no-thinking";

// Gemini 3.x Models (Fastest Free Tier Models)
const MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash",
  "gemini-3.8-flash",
];

// ---------- SPEED & VALIDATION SETTINGS ----------
const MAX_OUTPUT_TOKENS = 250;     // Fast reply ke liye short token limit
const PER_CALL_TIMEOUT_MS = 3500;  // 3.5 sec timeout per model (fast fallback)
const MAX_MESSAGE_CHARS = 1000;
const MAX_HISTORY = 10;            // Fast prompt processing
const OFF_TOPIC_TAG = "OFF_TOPIC";
const OFF_TOPIC_MESSAGE = "Please ask questions related to agriculture only.";

const SYSTEM_PROMPT = `You are Farman Kisan Hub AI Assistant, an expert agricultural advisor.

SCOPE RULE:
- You ONLY answer questions related to agriculture, farming, crops, livestock, soil, fertilizers, pesticides, irrigation, weather for farming, and farm machinery.
- If user greets (hi, hello, salam), respond warmly in 1 line offering farming help.
- If message is completely UNRELATED to agriculture, reply strictly with ONLY: ${OFF_TOPIC_TAG}

ANSWER RULE:
- Give extremely short, direct, precise answers (2 to 3 sentences max).
- NO markdown formatting (no bold **, no stars *, no hashtags #).
- NEVER output internal reasoning or thinking. Answer directly in the user's language (Roman Urdu, Urdu, or English).`;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function callGeminiFast(model, apiKey, contents) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PER_CALL_TIMEOUT_MS);

  try {
    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/" +
      model +
      ":generateContent?key=" +
      apiKey;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: contents,
        generationConfig: {
          temperature: 0.2, // Fast, direct deterministic answers
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          thinkingConfig: { thinkingBudget: 0 }, // CRITICAL: Turns off thinking overhead for Gemini 3.x!
        },
      }),
      signal: controller.signal,
    });

    const data = await response.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const text = parts.map((p) => p.text || "").join("").trim();

    if (response.ok && text) {
      return { ok: true, text: text, usage: data.usageMetadata || null };
    }

    const err = data?.error?.message || "HTTP " + response.status;
    return { ok: false, err: err };
  } catch (e) {
    const isTimeout = e.name === "AbortError";
    return { ok: false, err: isTimeout ? "timeout" : e.message };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(200).json({
      reply: "API is online.",
      version: VERSION,
      models: MODELS,
    });
  }

  const startTime = Date.now();

  try {
    // 1. Input Validation
    let body;
    try {
      body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    } catch (e) {
      return res.status(200).json({ reply: "Invalid request format." });
    }

    const rawMessages = body?.messages;
    if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
      return res.status(200).json({ reply: "Please write a message." });
    }

    const messages = [];
    for (const m of rawMessages) {
      if (!m || typeof m !== "object") continue;
      const role = m.role === "user" ? "user" : "model";
      const content = typeof m.content === "string" ? m.content.trim() : "";
      if (content) messages.push({ role, content: content.slice(0, MAX_MESSAGE_CHARS) });
    }

    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.role !== "user" || !lastMsg.content) {
      return res.status(200).json({ reply: "Please type a proper question." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(200).json({ reply: "Configuration Error: API Key missing." });
    }

    // 2. Prepare Payload (Last 10 messages for maximum response speed)
    const history = messages.slice(-MAX_HISTORY);
    while (history.length && history[0].role !== "user") history.shift();

    const formattedContents = history.map((msg) => ({
      role: msg.role,
      parts: [{ text: msg.content }],
    }));

    // 3. Fast Execution (Try models sequentially with 3.5s hard timeout)
    let result = null;
    let usedModel = null;
    const errors = [];

    for (const model of MODELS) {
      const resAttempt = await callGeminiFast(model, apiKey, formattedContents);
      if (resAttempt.ok) {
        result = resAttempt;
        usedModel = model;
        break;
      }
      errors.push(model + ": " + resAttempt.err);
    }

    // 4. Handle Failure Fallback
    if (!result) {
      return res.status(200).json({
        reply: "AI server abhi busy hai. Please 30 second baad dobara koshish karein.",
        debug: errors.join(" || "),
      });
    }

    // 5. Agriculture Filter & Output Cleaning
    let cleanReply = result.text
      .replace(/\*\*/g, "")
      .replace(/\*/g, "")
      .replace(/#/g, "")
      .trim();

    let offTopic = false;
    if (cleanReply.toUpperCase().includes(OFF_TOPIC_TAG)) {
      offTopic = true;
      cleanReply = OFF_TOPIC_MESSAGE;
    }

    const tokens = {
      prompt: result.usage?.promptTokenCount || 0,
      answer: result.usage?.candidatesTokenCount || 0,
      total: result.usage?.totalTokenCount || 0,
    };

    return res.status(200).json({
      reply: cleanReply,
      offTopic: offTopic,
      tokens: tokens,
      model: usedModel,
      tookMs: Date.now() - startTime,
      version: VERSION,
    });
  } catch (err) {
    return res.status(200).json({ reply: "Server error: " + err.message });
  }
};
