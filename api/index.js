const VERSION = "v23-multi-key-free-rotation";

const MODELS = [
  "gemini-2.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash",
];

const PER_MODEL_TIMEOUT_MS = 6000;
const MAX_MESSAGE_CHARS = 10000;
const MAX_HISTORY = 6;

// Multiple Free Keys Extractor (Comma Separated Keys Support)
function getApiKeys() {
  const raw = process.env.GEMINI_API_KEY || "";
  return raw.split(",").map(k => k.trim()).filter(Boolean);
}

async function callSingleModelWithKey(model, apiKey, contents, systemPrompt) {
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
        generationConfig: { temperature: 0.2, maxOutputTokens: 850 },
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
    const isQuota = response.status === 429 || /quota|limit/i.test(errMsg);
    return { ok: false, err: errMsg, isQuota: isQuota };
  } catch (e) {
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

    const apiKeys = getApiKeys();
    if (apiKeys.length === 0) {
      return res.status(200).json({ reply: "Configuration Error: No GEMINI_API_KEY found in Vercel." });
    }

    const history = rawMessages.slice(-MAX_HISTORY);
    const formattedContents = history.map((msg) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }],
    }));

    if (imagePayload && imagePayload.data) {
      const lastFormatted = formattedContents[formattedContents.length - 1];
      lastFormatted.parts.unshift({
        inlineData: { mimeType: imagePayload.mimeType || "image/jpeg", data: imagePayload.data }
      });
    }

    let result = null;
    let usedModel = null;
    const errors = [];

    // FREE ROTATION: Har Free Key aur Model combination try hoga
    for (const apiKey of apiKeys) {
      for (const model of MODELS) {
        const attempt = await callSingleModelWithKey(model, apiKey, formattedContents, "You are Farman Kisan Hub AI Assistant.");
        if (attempt.ok) {
          result = attempt;
          usedModel = model;
          break;
        }
        errors.push(`${model}: ${attempt.err}`);
      }
      if (result) break; // Success milte hi exit!
    }

    if (!result) {
      return res.status(200).json({
        reply: "AI server is temporarily busy. Please try again in a moment.",
        debug: errors.join(" || ")
      });
    }

    return res.status(200).json({
      reply: result.text,
      model: usedModel,
      version: VERSION
    });
  } catch (err) {
    return res.status(200).json({ reply: "Server error: " + err.message });
  }
};
