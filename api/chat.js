const VERSION = "v17-fast-expert-diagnostic";

// Fast & Reliable Gemini Models
const MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash",
  "gemini-flash-lite-latest",
  "gemini-flash-latest",
];

// ---------- ULTRA FAST EXPERT SETTINGS ----------
const MAX_OUTPUT_TOKENS = 450;     // Fast response + complete diagnostic breakdown
const PER_MODEL_TIMEOUT_MS = 4000; // 4s strict timeout
const MAX_MESSAGE_CHARS = 10000;   // 10,000 input chars support
const MAX_HISTORY = 6;
const OFF_TOPIC_TAG = "OFF_TOPIC";
const OFF_TOPIC_MESSAGE = "Please ask questions related to agriculture only.";

const SYSTEM_PROMPT = `You are Farman Kisan Hub AI Assistant, a senior expert agricultural advisor tailored specifically for Pakistani farmers (especially Punjab / South Punjab conditions).

SCOPE RULE:
- You ONLY answer questions related to agriculture, farming, crops, livestock, soil, fertilizers, pesticides, plant diseases, irrigation, weather for farming, and farm machinery.
- If user greets (hi, hello, salam), respond warmly in 1 short line offering farming help.
- If message is completely UNRELATED to agriculture, reply strictly with ONLY: ${OFF_TOPIC_TAG}

EXPERT PAKISTANI AGRICULTURAL DIAGNOSTIC PROTOCOL:
Do NOT jump to chemical treatments or sprays immediately. Follow this structured sequence:
1. Context Check: Identify crop, variety, stage, location (Punjab/South Punjab context), soil, water, and management history.
2. Plausible Causes & Evidence: List top probable causes with evidence FOR and AGAINST each cause. Differentiate similar-looking symptoms.
3. Safe & Cheap Verification First: Recommend the cheapest, safest physical check (root test, moisture check) BEFORE expensive treatments.
4. Treatment Rationale & Calculation: Recommend treatment only after explaining evidence. When farm size/data is provided, calculate exact: (a) Per-Acre Quantity, (b) Total Quantity, and (c) Estimated Cost in PKR.
5. Pakistani Context & Uncertainty: Use Pakistani local terminology and fertilizers. State confidence level (High/Medium/Low). If data is insufficient, explicitly state it instead of guessing. Provide a step-by-step decision tree if treatment fails.

FORMATTING:
- Keep the answer structured, concise, direct, and complete (under 120 words).
- Do NOT use markdown stars (*) or bold (**). Answer in user's query language (Roman Urdu, Urdu, or English).`;

async function callSingleModel(model, apiKey, contents) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PER_MODEL_TIMEOUT_MS);

  // 1. Ultra Fast Payload: thinkingBudget = 0 turns OFF internal reasoning delay for sub-second responses
  const payloadFast = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: contents,
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  // 2. Standard Fallback Payload (In case a model doesn't support thinkingConfig)
  const payloadStandard = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: contents,
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
    },
  };

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    let response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payloadFast),
      signal: controller.signal,
    });

    let data = await response.json();

    // If HTTP 400 due to thinkingConfig parameter on older models, retry instantly with standard payload
    if (!response.ok && data?.error?.message && /thinking/i.test(data.error.message)) {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadStandard),
        signal: controller.signal,
      });
      data = await response.json();
    }

    const parts = data?.candidates?.[0]?.content?.parts || [];
    const text = parts.map((p) => p.text || "").join("").trim();

    if (response.ok && text) {
      return { ok: true, text: text, usage: data.usageMetadata || null };
    }

    const errMsg = data?.error?.message || `HTTP ${response.status}`;
    return { ok: false, err: errMsg };
  } catch (e) {
    const isTimeout = e.name === "AbortError";
    return { ok: false, err: isTimeout ? `timeout (${PER_MODEL_TIMEOUT_MS}ms)` : e.message };
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
        reply: "AI server is temporarily busy. Please try again in a few seconds.",
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
