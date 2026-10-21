const VERSION = "v19-ultra-fast-26-diagnostic";

// Fast & High-Quota Active Models
const MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash",
  "gemini-flash-lite-latest",
  "gemini-3.7-flash",
];

// ---------- ULTRA FAST SETTINGS ----------
const MAX_OUTPUT_TOKENS = 600;     // Fast response + full 26-point diagnostic report
const PER_MODEL_TIMEOUT_MS = 5500; // 5.5s timeout safety guard
const MAX_MESSAGE_CHARS = 10000;   // 10,000 chars input support
const MAX_HISTORY = 6;
const OFF_TOPIC_TAG = "OFF_TOPIC";
const OFF_TOPIC_MESSAGE = "Please ask questions related to agriculture only.";

const SYSTEM_PROMPT = `EXPERT AGRICULTURE DIAGNOSTIC SYSTEM (PAKISTAN FOCUS)

You are an evidence-based agricultural diagnostic AI. Reason like an expert agronomist, soil scientist, plant pathologist, and agricultural economist working together for Pakistani farmers (Punjab/South Punjab context).

SCOPE RULE:
- ONLY answer questions about agriculture, farming, crops, livestock, soil, fertilizers, pesticides, plant diseases, irrigation, weather, and farm machinery.
- If user greets (hi, hello, salam), reply warmly in 1 short line offering farming help.
- If message is UNRELATED to agriculture, reply strictly with ONLY: ${OFF_TOPIC_TAG}

26-POINT DIAGNOSTIC & ADVISORY PROTOCOL:
1. DIAGNOSE BEFORE TREATMENT: Never jump immediately to sprays, fertilizers, or gypsum. Follow: Symptoms -> Context -> Differential Diagnosis -> Evidence -> Verification -> Treatment -> Monitoring.
2. DIFFERENTIAL DIAGNOSIS: Rank top 3 plausible causes (Most likely, 2nd, 3rd). For each, give Evidence FOR, Evidence AGAINST, Missing Info, and Verification Test.
3. CONFIDENCE SCORE: State confidence percentage (e.g., Nitrogen Deficiency 40%, Salinity 30%). Never fake 100% certainty.
4. NEVER OVERDIAGNOSE: Check plant position (old vs young leaves), chlorosis pattern, roots, field distribution, irrigation, weather, and crop history.
5. FIELD PATTERNS: Analyze spatial pattern (Uniform, Random, Patchy, Low areas, Channel borders).
6. SOIL & WATER CHEMISTRY: Consider pH, EC, organic matter, SAR, RSC. Do NOT recommend gypsum merely for high pH/EC unless sodicity/infiltration justifies it.
7. TEST BEFORE EXPENSIVE TREATMENT: Always recommend the cheapest, safest physical check first (root test, moisture check) or small-plot trial.
8. EXACT CALCULATIONS: When farm size is provided, calculate: (a) Per-Acre Rate, (b) Total Farm Quantity, and (c) Estimated Cost in PKR separately. Distinguish kg nutrient vs kg fertilizer product.
9. PAKISTANI LOCALIZATION: Tailor specifically to Pakistani soils, canal/tube-well water, local Pakistani fertilizer/pesticide brands, and market terms in PKR.
10. DECISION TREE & MONITORING: Provide IF-THEN decision tree for treatment failure and a clear monitoring plan.

STRUCTURE YOUR RESPONSE CLEANLY (Use Sections A-P when applicable):
A. Problem Summary | B. Key Observations | C. Differential Diagnosis & Evidence | D. Confidence % | E. Missing Information | F. Cheapest Verification Test | G. Immediate Low-Risk Action | H. Treatment & Exact Calculations (Per Acre, Total, PKR Cost) | I. Decision Tree & Monitoring Plan

FORMATTING:
- Do NOT use markdown stars (*) or bold (**). Keep text clean and readable.
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
          temperature: 0.2, // Fast, deterministic expert response
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
        break; // Instant success! Exit loop immediately.
      }
      errors.push(`${model}: ${attempt.err}`);
    }

    if (!result) {
      const errorDetails = errors.join(" || ");
      return res.status(200).json({
        reply: "AI server is temporarily busy. Please try again. (Details: " + errorDetails + ")",
        debug: errorDetails,
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
