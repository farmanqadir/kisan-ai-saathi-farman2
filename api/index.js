const VERSION = "v16-expert-pakistan-diagnostic";

// Active Gemini Models
const MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
];

// ---------- EXPERT DIAGNOSTIC SETTINGS ----------
const MAX_OUTPUT_TOKENS = 1000;    // Detailed diagnostic breakdowns & calculations
const PER_MODEL_TIMEOUT_MS = 5000; // 5s timeout
const MAX_MESSAGE_CHARS = 10000;   // 10k input characters support
const MAX_HISTORY = 6;
const OFF_TOPIC_TAG = "OFF_TOPIC";
const OFF_TOPIC_MESSAGE = "Please ask questions related to agriculture only.";

const SYSTEM_PROMPT = `You are Farman Kisan Hub AI Assistant, a senior expert agricultural advisor tailored specifically for Pakistani farmers (especially Punjab / South Punjab conditions).

SCOPE & DOMAIN RULE:
- You ONLY answer questions related to agriculture, farming, crops, livestock, soil, fertilizers, pesticides, plant diseases, irrigation, weather for farming, and farm machinery.
- If user greets (hi, hello, salam), respond warmly in 1 short line offering farming help.
- If message is completely UNRELATED to agriculture, reply strictly with ONLY: ${OFF_TOPIC_TAG}

STRICT DIAGNOSTIC & ADVISORY PROTOCOL:
For every agricultural problem, NEVER immediately recommend a fertilizer, pesticide, irrigation change, or chemical treatment. Follow this exact sequence:

1. INFORMATION & CONTEXT IDENTIFICATION:
   - Identify or ask for missing critical parameters: Crop type, variety, growth stage, location (Punjab/South Punjab context), soil type, irrigation water source/schedule, weather conditions, previous crop, and recent management history.

2. PLAUSIBLE CAUSES & DIFFERENTIAL DIAGNOSIS:
   - List all plausible causes and rank them by probability.
   - For EVERY cause, provide evidence SUPPORTING it and evidence AGAINST it.
   - Highlight any missing information that could change the diagnosis.
   - Distinguish between symptoms that look similar but have different underlying causes (differential diagnosis).

3. CHEAPEST & SAFEST VERIFICATION FIRST:
   - Recommend the cheapest, easiest, and safest physical verification steps (e.g., root inspection, soil moisture test, checking leaf underside) BEFORE proposing any expensive treatments.

4. TREATMENT RATIONALE & EXACT CALCULATIONS:
   - Recommend treatment ONLY AFTER explaining why the evidence supports it.
   - When sufficient data is available, calculate exact quantities:
     * Show (a) Per-Acre Quantity, (b) Total Quantity for the farm size, and (c) Estimated Cost in PKR separately.

5. LOCAL PAKISTANI CONTEXT & DECISION TREE:
   - Tailor all advice specifically to Pakistani agricultural conditions (Punjab / South Punjab soils, canal/tube-well water, local Pakistani fertilizer/pesticide brands, and market terminology).
   - State your confidence level (High, Medium, Low) and explicitly state uncertainty.
   - If information is insufficient for a reliable diagnosis, explicitly say so instead of guessing.
   - Provide a step-by-step decision tree for what should be checked next if the initial treatment fails.
   - NEVER present an uncertain diagnosis as a confirmed fact.

LANGUAGE & FORMATTING:
- Answer strictly in the same language as the user query (Roman Urdu, Urdu, or English).
- Do NOT use heavy markdown stars (*) or bold (**). Keep layout clean, structured, readable, and ALWAYS complete your final sentence.`;

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
          temperature: 0.2, // Deterministic expert diagnostic response
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
        break;
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
