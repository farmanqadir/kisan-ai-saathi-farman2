// api/chat.js

const VERSION = "v25-complete-answers-fix";

const MODELS = [
  "gemini-3.8-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
];

const PER_MODEL_TIMEOUT_MS = 15000; // thinking models ko thora zyada time chahiye
const MAX_MESSAGE_CHARS = 10000;
const MAX_HISTORY = 6;

function getApiKey() {
  return (process.env.GEMINI_API_KEY || "").trim();
}

async function callSingleModel(model, apiKey, contents, systemPrompt) {
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
          temperature: 0.4,
          maxOutputTokens: 4096,       // ✅ pehle sirf 850 tha — ab bohot zyada
          topP: 0.95,
          topK: 40,
        },
        // ✅ Thinking models ka extra "internal reasoning" token cost zero karo
        // taake pura budget actual answer ke liye use ho
        thinkingConfig: {
          thinkingBudget: 0
        }
      }),
      signal: controller.signal,
    });

    const data = await response.json();
    const candidate = data?.candidates?.[0];
    const parts = candidate?.content?.parts || [];
    const text = parts.map((p) => p.text || "").join("").trim();
    const finishReason = candidate?.finishReason;

    // Agar response token limit ki wajah se kata hai, to log karo
    if (finishReason === "MAX_TOKENS") {
      console.warn(`[TRUNCATED] ${model} -> response cut due to MAX_TOKENS`);
    }

    if (response.ok && text) {
      return {
        ok: true,
        text,
        usage: data.usageMetadata || null,
        truncated: finishReason === "MAX_TOKENS",
      };
    }

    const errMsg = data?.error?.message || `HTTP ${response.status}`;
    const isQuota = response.status === 429 || /quota|limit/i.test(errMsg);

    console.error(`[MODEL FAIL] ${model} -> ${errMsg}`);
    return { ok: false, err: errMsg, isQuota };
  } catch (e) {
    console.error(`[MODEL EXCEPTION] ${model} -> ${e.message}`);
    return { ok: false, err: e.message };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(200).json({ status: "online", version: VERSION });
  }

  try {
    let body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const rawMessages = body?.messages;
    const imagePayload = body?.image;

    if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
      return res.status(200).json({ reply: "Please write a message." });
    }

    const apiKey = getApiKey();
    if (!apiKey) {
      console.error("NO API KEY FOUND IN ENV");
      return res.status(200).json({ reply: "Configuration Error: No GEMINI_API_KEY found in Vercel." });
    }

    const history = rawMessages.slice(-MAX_HISTORY).map((m) => ({
      ...m,
      content: (m.content || "").slice(0, MAX_MESSAGE_CHARS),
    }));

    const formattedContents = history.map((msg) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }],
    }));

    if (imagePayload && imagePayload.data) {
      const lastFormatted = formattedContents[formattedContents.length - 1];
      lastFormatted.parts.unshift({
        inlineData: {
          mimeType: imagePayload.mimeType || "image/jpeg",
          data: imagePayload.data,
        },
      });
    }

    let result = null;
    let usedModel = null;
    const errors = [];

    for (const model of MODELS) {
      const attempt = await callSingleModel(
        model,
        apiKey,
        formattedContents,
        "You are Farman Kisan Hub AI Assistant. Always give complete, well-structured answers without cutting off mid-sentence."
      );
      if (attempt.ok) {
        result = attempt;
        usedModel = model;
        break;
      }
      errors.push(`${model}: ${attempt.err}`);
    }

    if (!result) {
      console.error("ALL MODELS FAILED:", errors.join(" || "));
      return res.status(200).json({
        reply: "AI server is temporarily busy. Please try again in a moment.",
        debug: errors.join(" || "),
      });
    }

    return res.status(200).json({
      reply: result.text,
      model: usedModel,
      version: VERSION,
      truncated: result.truncated || false,
    });
  } catch (err) {
    console.error("HANDLER ERROR:", err);
    return res.status(200).json({ reply: "Server error: " + err.message });
  }
};
