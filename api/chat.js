const VERSION = "v8-ultra-fast-race";

// Gemini Fast Models List
const MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite-preview",
  "gemini-3.6-flash",
];

const MAX_OUTPUT_TOKENS = 200; // Ultra short response for instant speed
const MAX_MESSAGE_CHARS = 1000;
const MAX_HISTORY = 6;         // Light prompt payload = sub-second response
const OFF_TOPIC_TAG = "OFF_TOPIC";
const OFF_TOPIC_MESSAGE = "Please ask questions related to agriculture only.";

const SYSTEM_PROMPT = `You are Farman Kisan Hub AI Assistant, an expert agricultural advisor.

SCOPE RULE:
- You ONLY answer questions related to agriculture, farming, crops, livestock, soil, fertilizers, pesticides, irrigation, weather for farming, and farm machinery.
- If user greets (hi, hello, salam), respond warmly in 1 short line.
- If message is UNRELATED to agriculture, reply strictly with ONLY: ${OFF_TOPIC_TAG}

ANSWER RULE:
- Give extremely short, direct, precise answers (1 to 3 sentences max).
- Absolutely NO markdown formatting (no bold **, no stars *, no hashtags #).
- Answer directly in the user's language (Roman Urdu, Urdu, or English).`;

// Single Model Call
async function callSingleModel(model, apiKey, contents, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: contents,
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
        },
      }),
      signal: controller.signal,
    });

    const data = await response.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const text = parts.map((p) => p.text || "").join("").trim();

    if (response.ok && text) {
      return { ok: true, model: model, text: text, usage: data.usageMetadata || null };
    }

    const errMsg = data?.error?.message || `HTTP ${response.status}`;
    return { ok: false, model: model, err: errMsg };
  } catch (e) {
    const isTimeout = e.name === "AbortError";
    return { ok: false, model: model, err: isTimeout ? `timeout (${timeoutMs}ms)` : e.message };
  } finally {
    clearTimeout(timer);
  }
}

// Parallel Race Engine: Jo Sabse Pehle Answer Dega Wahi Win Karega!
async function raceModels(apiKey, contents) {
  return new Promise((resolve) => {
    let resolved = false;
    const errors = [];
    let completedCount = 0;

    MODELS.forEach((model, index) => {
      // Staggered Parallel Execution (0ms, 500ms, 1000ms...)
      setTimeout(async () => {
        if (resolved) return;

        const res = await callSingleModel(model, apiKey, contents, 4000);
        completedCount++;

        if (res.ok && !resolved) {
          resolved = true;
          resolve(res);
        } else if (!res.ok) {
          errors.push(`${res.model}: ${res.err}`);
          if (completedCount === MODELS.length && !resolved) {
            resolved = true;
            resolve({ ok: false, err: errors.join(" || ") });
          }
        }
      }, index * 500);
    });

    // Global Fallback Timeout (5 Seconds Max)
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve({ ok: false, err: errors.length ? errors.join(" || ") : "Global timeout (5000ms)" });
      }
    }, 5000);
  });
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

    // Launch Parallel Race
    const raceResult = await raceModels(apiKey, formattedContents);

    if (!raceResult.ok) {
      return res.status(200).json({
        reply: "AI server busy. Please retry in a few seconds.",
        debug: raceResult.err,
        tookMs: Date.now() - startTime,
        version: VERSION,
      });
    }

    let cleanReply = raceResult.text
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
        prompt: raceResult.usage?.promptTokenCount || 0,
        answer: raceResult.usage?.candidatesTokenCount || 0,
        total: raceResult.usage?.totalTokenCount || 0,
      },
      model: raceResult.model,
      tookMs: Date.now() - startTime,
      version: VERSION,
    });
  } catch (err) {
    return res.status(200).json({ reply: "Server error: " + err.message });
  }
};
