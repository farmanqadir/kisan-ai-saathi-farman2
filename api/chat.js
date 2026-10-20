const VERSION = "v11-bulletproof-ultra-fast";

// Sirf 3 Sabse Tez & Fast Models (No Heavy Models, No Quota Waste)
const MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash",
];

// ---------- BULLETPROOF SETTINGS ----------
const MAX_OUTPUT_TOKENS = 400;     // Mukammal (complete) sentences ke liye perfect limit
const PER_MODEL_TIMEOUT_MS = 2200; // 2.2 sec strict timeout per model (Ultra fast speed)
const MAX_MESSAGE_CHARS = 1000;
const MAX_HISTORY = 6;             // Chhota prompt = Sub-second response time
const OFF_TOPIC_TAG = "OFF_TOPIC";
const OFF_TOPIC_MESSAGE = "Please ask questions related to agriculture only.";

const SYSTEM_PROMPT = `You are Farman Kisan Hub AI Assistant, an expert agricultural advisor.

SCOPE RULE:
- You ONLY answer questions related to agriculture, farming, crops, livestock, soil, fertilizers, pesticides, plant diseases, irrigation, weather for farming, and farm machinery.
- If user greets (hi, hello, salam), respond warmly in 1 short line offering farming help.
- If message is completely UNRELATED to agriculture, reply strictly with ONLY: ${OFF_TOPIC_TAG}

ANSWER RULE:
- Give short, concise, accurate, and COMPLETE answers (2 to 4 full sentences).
- ALWAYS complete your sentences fully. Never leave an answer cut off.
- Do NOT use markdown symbols like stars (*), bold (**), or hashtags (#).
- Answer strictly in the same language as user query (Roman Urdu, Urdu, or English).`;

async function callSingleModel(model, apiKey, contents) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PER_MODEL_TIMEOUT_MS);

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: contents,
        generationConfig: {
          temperature: 0.2, // Fast, deterministic replies
          maxOutputTokens: MAX_OUTPUT_TOKENS,
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

    const errMsg = data?.error?.message || `HTTP ${response.status}`;
    const isRateLimit = response.status === 429 || /quota|rate limit/i.test(errMsg);
    return { ok: false, err: errMsg, isRateLimit: isRateLimit };
  } catch (e) {
    const isTimeout = e.name === "AbortError";
    return { ok: false, err: isTimeout ? "timeout" : e.message, isTimeout: isTimeout };
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
      return res.status(200).json({ reply: "Configuration Error: API Key missing in Vercel." });
    }

    const history = messages.slice(-MAX_HISTORY);
    while (history.length && history[0].role !== "user") history.shift();

    const formattedContents = history.map((msg) => ({
      role: msg.role,
      parts: [{ text: msg.content }],
    }));

    // Sequential Fast Execution (Max 3 attempts, Stops on First Success)
    let result = null;
    let usedModel = null;
    const errors = [];

    for (const model of MODELS) {
      const attempt = await callSingleModel(model, apiKey, formattedContents);
      if (attempt.ok) {
        result = attempt;
        usedModel = model;
        break; // Instant success! Exit loop immediately.
      }
      errors.push(`${model}: ${attempt.err}`);
    }

    if (!result) {
      return res.status(200).json({
        reply: "Server busy. Please try again in 5 seconds.",
        debug: errors.join(" || "),
        tookMs: Date.now() - startTime,
        version: VERSION,
      });
    }

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

    return res.status(200).json({
      reply: cleanReply,
      offTopic: offTopic,
      tokens: {
        prompt: result.usage?.promptTokenCount || 0,
        answer: result.usage?.candidatesTokenCount || 0,
        total: result.usage?.totalTokenCount || 0,
      },
      model: usedModel,
      tookMs: Date.now() - startTime,
      version: VERSION,
    });
  } catch (err) {
    return res.status(200).json({ reply: "Server error: " + err.message });
  }
};
