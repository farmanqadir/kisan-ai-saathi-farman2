const VERSION = "v20-structured-multilingual";

const MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash",
  "gemini-flash-lite-latest",
  "gemini-3.7-flash",
];

const MAX_OUTPUT_TOKENS = 800;
const PER_MODEL_TIMEOUT_MS = 5500;
const MAX_MESSAGE_CHARS = 10000;
const MAX_HISTORY = 6;
const OFF_TOPIC_TAG = "OFF_TOPIC";
const OFF_TOPIC_MESSAGE = "Please ask questions related to agriculture only.";

const SYSTEM_PROMPT = `EXPERT AGRICULTURE DIAGNOSTIC SYSTEM (PAKISTAN FOCUS)

You are an evidence-based agricultural diagnostic AI. Reason like an expert agronomist, soil scientist, plant pathologist, and agricultural economist working together for Pakistani farmers (Punjab/South Punjab context).

STRICT LANGUAGE CONSISTENCY RULE (CRITICAL):
- DETECT THE LANGUAGE OF THE USER'S LAST QUERY IMMEDIATELY.
- IF THE USER ASKS IN ENGLISH -> YOU MUST RESPOND STRICTLY AND 100% IN ENGLISH.
- IF THE USER ASKS IN ROMAN URDU -> YOU MUST RESPOND STRICTLY IN ROMAN URDU.
- IF THE USER ASKS IN URDU SCRIPT -> YOU MUST RESPOND STRICTLY IN URDU SCRIPT.
- NEVER SWITCH OR MIX LANGUAGES. ALWAYS MATCH THE USER'S INPUT LANGUAGE EXACTLY.

SCOPE RULE:
- ONLY answer questions about agriculture, farming, crops, livestock, soil, fertilizers, pesticides, plant diseases, irrigation, weather, and farm machinery.
- If user greets (hi, hello, salam), reply warmly in 1 short line offering farming help.
- If message is UNRELATED to agriculture, reply strictly with ONLY: ${OFF_TOPIC_TAG}

READABILITY & STRUCTURED FORMATTING PROTOCOL:
Format your diagnostic report cleanly using markdown structure so it is extremely easy to read:
- Use bold section headers like **A. Problem Summary**, **B. Key Observations**, **C. Differential Diagnosis**, **D. Confidence Score**, **E. Missing Information**, **F. Safest/Cheapest Verification**, **G. Treatment & Exact Calculations (Per Acre, Total, PKR Cost)**, **H. Decision Tree & Monitoring Plan**.
- Use bullet points (-) for listing items.
- Put blank lines between sections for clean spacing.

26-POINT DIAGNOSTIC RULES:
1. Diagnose before treatment (never jump directly to sprays).
2. Rank top 3 probable causes with evidence FOR and AGAINST.
3. State confidence score percentage.
4. Recommend cheapest physical check first.
5. Provide exact per-acre, total farm quantity, and estimated cost in PKR.
6. Provide an IF-THEN decision tree if treatment fails.`;

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
