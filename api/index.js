const VERSION = "v21-adaptive-mode-engine";

const MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash",
  "gemini-flash-lite-latest",
  "gemini-3.7-flash",
];

const PER_MODEL_TIMEOUT_MS = 5500;
const MAX_MESSAGE_CHARS = 10000;
const MAX_HISTORY = 6;
const OFF_TOPIC_TAG = "OFF_TOPIC";
const OFF_TOPIC_MESSAGE = "Please ask questions related to agriculture only.";

function buildSystemPrompt(mode) {
  let modeInstruction = "";

  if (mode === "easy") {
    modeInstruction = `MODE: EASY / AAM FEHMI.
    - Give extremely simple, easy-to-understand, friendly advice in plain words.
    - Avoid complex scientific jargon. Max 3-4 bullet points.`;
  } else if (mode === "fast") {
    modeInstruction = `MODE: FAST / DIRECT.
    - Give an ultra-short, direct, 2-to-3 sentence answer.
    - Zero fluff, immediate solution.`;
  } else {
    // Hard / Expert Mode
    modeInstruction = `MODE: HARD / EXPERT DIAGNOSTIC (26-POINT SYSTEM).
    - Follow full Agronomist Diagnostic Protocol.
    - Include Differential Diagnosis, Evidence FOR/AGAINST, Confidence %, Cheapest Verification First, Per-Acre + Total Farm Quantity, and Estimated Cost in PKR.`;
  }

  return `EXPERT AGRICULTURE DIAGNOSTIC SYSTEM (PAKISTAN FOCUS)

You are an evidence-based agricultural diagnostic AI for Pakistani farmers (Punjab/South Punjab context).

STRICT LENGTH RULE (ADAPTIVE RESPONSE):
- MATCH THE RESPONSE LENGTH STRICTLY TO THE USER'S QUERY LENGTH AND COMPLEXITY.
- If the user asks a simple or short question (e.g. "Salam", "DAP ka rate kya hai?"), answer in 1 to 2 short lines only.
- Do NOT output a full 26-point diagnostic report for small or simple queries.
- Only provide a full diagnostic breakdown when the user presents a complex crop disease or farm problem.

STRICT LANGUAGE CONSISTENCY RULE:
- MATCH THE USER'S INPUT LANGUAGE 100% EXACTLY.
- IF USER ASKS IN ENGLISH -> RESPOND 100% IN ENGLISH.
- IF USER ASKS IN ROMAN URDU -> RESPOND STRICTLY IN ROMAN URDU.
- IF USER ASKS IN URDU SCRIPT -> RESPOND STRICTLY IN URDU SCRIPT.
- NEVER MIX OR SWITCH LANGUAGES.

SCOPE RULE:
- ONLY answer questions about agriculture, farming, crops, livestock, soil, fertilizers, pesticides, plant diseases, irrigation, weather, and farm machinery.
- If greeting, respond warmly in 1 line.
- If completely UNRELATED to farming, reply strictly with ONLY: ${OFF_TOPIC_TAG}

${modeInstruction}

READABILITY & FORMATTING:
- Use clear bold section headers like **Problem Summary**, **Diagnosis**, **Recommended Action**, **Cost Calculation**.
- Use clean bullet points (-) and line breaks. Do not overcrowd text.`;
}

async function callSingleModel(model, apiKey, contents, systemPrompt, maxTokens) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PER_MODEL_TIMEOUT_MS);

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: contents,
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: maxTokens,
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
    return res.status(200).json({ reply: "API is online.", version: VERSION, models: MODELS });
  }

  const startTime = Date.now();

  try {
    let body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const rawMessages = body?.messages;
    const mode = body?.mode || "hard"; // "easy", "fast", or "hard"

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

    // Set max tokens based on Mode and Query length
    const isShortQuery = lastMsg.content.length < 30;
    const maxTokens = (mode === "fast" || isShortQuery) ? 250 : (mode === "easy" ? 450 : 850);

    const systemPrompt = buildSystemPrompt(mode);

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
      const attempt = await callSingleModel(model, apiKey, formattedContents, systemPrompt, maxTokens);
      if (attempt.ok) {
        result = attempt;
        usedModel = model;
        break;
      }
      errors.push(`${model}: ${attempt.err}`);
    }

    if (!result) {
      return res.status(200).json({
        reply: "AI server is temporarily busy. Please try again.",
        debug: errors.join(" || "),
        tookMs: Date.now() - startTime,
        version: VERSION,
      });
    }

    let cleanReply = result.text.trim();
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
