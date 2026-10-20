const VERSION = "v6-retry-no-2.5";

// Pehla model jo kaam kare wahi use hota hai.
// 2.5 wale hata diye: aapki key ke liye Google ne band kar diye hain, aur har message par
// 2 faltu failed calls ki wajah se reply slow bhi ho raha tha.
// 3.8-flash sabse aakhir mein hai (limit sirf 20/day) - sirf emergency fallback.
const MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-3.1-flash-lite-preview",
  "gemini-3.5-flash",
  "gemini-3.6-flash",
  "gemini-3.7-flash",
  "gemini-3-flash-preview",
  "gemini-3.8-flash",
];

// ---------- SETTINGS ----------
const ANSWER_TOKENS = 300;          // (3) Answer tokens limit
const MAX_MESSAGE_CHARS = 1000;     // (1) Validation: ek message mein max characters
const MAX_HISTORY = 20;             // AI ko sirf last 20 messages bhejte hain (fast + kam tokens)
const OFF_TOPIC_TAG = "OFF_TOPIC";  // (2) AI ye tag bhejta hai jab sawal agriculture ka na ho
const OFF_TOPIC_MESSAGE = "Please ask questions related to agriculture only.";

// ---------- BUSY / HIGH DEMAND HANDLING (naya) ----------
const MAX_PASSES = 3;                 // busy models ko kitni baar dobara try karna hai
const PASS_DELAY_MS = 700;            // har dobara-try se pehle itna wait (ms)
const PER_REQUEST_TIMEOUT_MS = 7000;  // ek Gemini call ka max time (ms)
const TOTAL_BUDGET_MS = 9000;         // poore handler ka max time (Vercel free 10s limit se neeche)
const SHOW_DEBUG_IN_REPLY = true;     // false karo to users ko sirf friendly message dikhega
const BUSY_MESSAGE = "AI server abhi busy hai. Please 1 minute baad dobara koshish karein.";
const QUOTA_MESSAGE = "AI ki aaj ki free limit khatam ho gayi hai. Please kuch dair baad dobara koshish karein.";

// Purane error/system replies AI ki history mein nahi bhejte (warna AI confuse hota hai)
const SKIP_IN_HISTORY = /^(API Error|AI server abhi busy|AI ki aaj ki free limit|Server exception|Network error|Invalid request|Configuration Error|Maazrat, jawab nahi mil saka)/i;

const SYSTEM_PROMPT = `You are Farman Kisan Hub AI Assistant, an expert agricultural advisor for farmers.

SCOPE RULE (most important):
- You ONLY answer questions related to agriculture and farming: crops, seeds, sowing, harvesting, soil, fertilizers, pesticides, weeds, plant diseases, insects and pests, irrigation, water, weather for farming, livestock, cattle, buffalo, goats, poultry, dairy, fish farming, bee keeping, farm machinery, tractors, tube wells, agricultural markets and crop prices, government schemes and loans for farmers, horticulture, fruits, vegetables, kitchen gardening, organic farming and farm business.
- If the user only greets you or thanks you (hello, hi, salam, assalam o alaikum, shukriya, thank you), reply with one short friendly line and say you can help with farming and agriculture questions.
- If the user's message is NOT related to agriculture or farming (for example programming, math, homework, movies, songs, sports, politics, human medicine, general knowledge, jokes or personal chat), reply with EXACTLY this single word and nothing else: ${OFF_TOPIC_TAG}

ANSWER STYLE:
- Give extremely short, concise, accurate and direct answers (maximum 2 to 4 sentences).
- Never output internal reasoning, rules or system thoughts.
- Do NOT use markdown symbols like stars (*), bold (**) or hashtags (#).
- Answer strictly in the same language as the user's query (Roman Urdu, Urdu or English).
- Remember the conversation history and use it for follow-up questions.`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Aisa error jo thori dair baad khud theek ho jata hai (high demand, overloaded, timeout...)
function isTransient(status, message) {
  if ([500, 502, 503, 504].includes(status)) return true;
  return /high demand|overloaded|temporar|try again later|unavailable|timeout|timed out|aborted/i.test(
    message || ""
  );
}

async function callGemini(model, apiKey, contents, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/" +
      model + ":generateContent?key=" + apiKey;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: contents,
        generationConfig: {
          temperature: 0.4,
          // 3.x models apne thinking tokens bhi isi limit mein ginte hain, is liye extra room
          maxOutputTokens: ANSWER_TOKENS * 4,
        },
      }),
      signal: controller.signal,
    });

    let data = null;
    try { data = await response.json(); } catch (e) { data = null; }

    const parts = data?.candidates?.[0]?.content?.parts || [];
    const text = parts.map((p) => p.text || "").join("").trim();

    if (response.ok && text) {
      return { ok: true, text: text, usage: data.usageMetadata || null };
    }

    const msg = data?.error?.message
      ? data.error.message
      : "empty reply (" + (data?.candidates?.[0]?.finishReason || "HTTP " + response.status) + ")";

    return { ok: false, msg: msg, transient: isTransient(response.status, msg) };
  } catch (err) {
    const msg = err.name === "AbortError" ? "timeout (" + timeoutMs + "ms)" : err.message;
    return { ok: false, msg: msg, transient: true };
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
      reply: "Invalid request method.",
      version: VERSION,
      models: MODELS,
    });
  }

  const started = Date.now();
  const deadline = started + TOTAL_BUDGET_MS;

  try {
    // ================= (1) VALIDATION =================
    let body;
    try {
      body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    } catch (e) {
      return res.status(200).json({ reply: "Invalid request: body is not valid JSON." });
    }

    const rawMessages = body?.messages;
    if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
      return res.status(200).json({ reply: "Invalid request: messages missing." });
    }

    const messages = [];
    for (const m of rawMessages) {
      if (!m || typeof m !== "object") continue;
      const role =
        m.role === "user" ? "user" :
        (m.role === "assistant" || m.role === "model") ? "model" : null;
      if (!role) continue;
      const content = typeof m.content === "string" ? m.content.trim() : "";
      if (!content) continue;
      if (role === "model" && SKIP_IN_HISTORY.test(content)) continue;
      messages.push({ role, content: content.slice(0, MAX_MESSAGE_CHARS * 2) });
    }

    if (messages.length === 0) {
      return res.status(200).json({ reply: "Please type a question first." });
    }

    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role !== "user") {
      return res.status(200).json({ reply: "Invalid request: last message must be from user." });
    }
    if (lastMsg.content.length < 2) {
      return res.status(200).json({ reply: "Please type a proper question." });
    }
    if (lastMsg.content.length > MAX_MESSAGE_CHARS) {
      return res.status(200).json({
        reply: "Message too long. Please keep it under " + MAX_MESSAGE_CHARS + " characters.",
      });
    }

    const history = messages.slice(-MAX_HISTORY);
    while (history.length && history[0].role !== "user") history.shift();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(200).json({
        reply: "Configuration Error: GEMINI_API_KEY missing in Vercel.",
      });
    }

    const formattedContents = history.map((msg) => ({
      role: msg.role,
      parts: [{ text: msg.content }],
    }));

    // ================= GEMINI CALL (auto-retry) =================
    let result = null;
    let usedModel = null;
    let attempts = 0;
    const lastError = new Map();
    let candidates = MODELS.slice();

    for (let pass = 0; pass < MAX_PASSES && !result && candidates.length; pass++) {
      if (pass > 0) {
        if (deadline - Date.now() < PASS_DELAY_MS + 1500) break;
        await sleep(PASS_DELAY_MS);
      }

      const busyModels = [];
      for (const model of candidates) {
        const remaining = deadline - Date.now();
        if (remaining < 1200) break;

        attempts++;
        const r = await callGemini(
          model, apiKey, formattedContents,
          Math.min(PER_REQUEST_TIMEOUT_MS, remaining - 300)
        );

        if (r.ok) {
          result = r;
          usedModel = model;
          break;
        }

        lastError.set(model, r.msg);
        if (r.transient) busyModels.push(model); // sirf busy wale dobara try honge
      }
      candidates = busyModels;
    }

    if (!result) {
      const errorList = Array.from(lastError.entries());
      const debugText = errorList
        .map(([m, e]) => m + ": " + String(e).slice(0, 120))
        .join(" || ");
      const allQuota = errorList.length > 0 && errorList.every(([, e]) => /quota/i.test(String(e)));

      let reply = allQuota ? QUOTA_MESSAGE : BUSY_MESSAGE;
      if (SHOW_DEBUG_IN_REPLY && debugText) reply += "\n\n(Debug: " + debugText + ")";

      return res.status(200).json({
        reply: reply,
        busy: !allQuota,
        attempts: attempts,
        tookMs: Date.now() - started,
        version: VERSION,
      });
    }

    // ================= (2) IRRELEVANT QUESTION CHECK =================
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

    // ================= (3) TOKENS =================
    const usage = result.usage;
    const tokens = {
      prompt: usage?.promptTokenCount || 0,
      answer: usage?.candidatesTokenCount || 0,
      total: usage?.totalTokenCount || 0,
    };

    return res.status(200).json({
      reply: cleanReply,
      offTopic: offTopic,
      tokens: tokens,
      model: usedModel,
      attempts: attempts,
      tookMs: Date.now() - started,
      version: VERSION,
    });
  } catch (err) {
    return res.status(200).json({ reply: "Server exception error: " + err.message });
  }
};
