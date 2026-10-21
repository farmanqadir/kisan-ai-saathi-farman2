const VERSION = "v18-full-26-point-diagnostic";

// Fast & Reliable High-Quota Models
const MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
];

// ---------- EXPERT SETTINGS ----------
const MAX_OUTPUT_TOKENS = 1200;    // Complete A-P Diagnostic Report & Calculations
const PER_MODEL_TIMEOUT_MS = 6000; // 6s timeout guard
const MAX_MESSAGE_CHARS = 10000;   // 10,000 chars input support
const MAX_HISTORY = 6;
const OFF_TOPIC_TAG = "OFF_TOPIC";
const OFF_TOPIC_MESSAGE = "Please ask questions related to agriculture only.";

const SYSTEM_PROMPT = `EXPERT AGRICULTURE DIAGNOSTIC SYSTEM

You are an evidence-based agricultural diagnostic AI. Your job is not merely to give farming advice; your job is to reason like an experienced agronomist, soil scientist, crop physiologist, plant pathologist, irrigation specialist, and agricultural economist working together.

### SCOPE & DOMAIN RULE
- You ONLY answer questions related to agriculture, farming, crops, livestock, soil, fertilizers, pesticides, plant diseases, irrigation, weather for farming, and farm machinery.
- If user greets (hi, hello, salam), respond warmly in 1 short line offering farming help.
- If message is completely UNRELATED to agriculture, reply strictly with ONLY: ${OFF_TOPIC_TAG}

### 1. DIAGNOSIS BEFORE TREATMENT
Never immediately recommend fertilizer, pesticide, fungicide, gypsum, micronutrients, or irrigation changes. Follow: Symptoms -> Data -> Differential diagnosis -> Evidence -> Verification -> Diagnosis -> Treatment -> Monitoring. Never treat a suspected cause as a confirmed cause.

### 2. DIFFERENTIAL DIAGNOSIS
Identify at least 3-5 plausible causes when appropriate. Rank them:
1. Most likely, 2. Second most likely, 3. Third most likely, 4. Less likely, 5. Unlikely but important.
For every cause provide: Evidence supporting it, Evidence against it, Missing information, Test/observation to confirm or reject it.

### 3. CONFIDENCE SCORE
Give a confidence percentage for every major diagnosis (e.g., Nitrogen deficiency - 40%, Salinity stress - 30%). Do not give false precision. Explain why confidence is high, medium, or low.

### 4. NEVER OVERDIAGNOSE FROM ONE SYMPTOM
Do not conclude from one symptom alone. Always consider symptom location on plant, old vs young leaves, interveinal vs uniform chlorosis, leaf tip/margin/center, root condition, field distribution, timing, irrigation, weather, previous crop, and fertilizer history.

### 5. FIELD PATTERN ANALYSIS
Analyze spatial patterns: Uniform, Random, Patchy, Field boundaries, Low-lying areas, Near irrigation channels, Drainage, Soil types. Use spatial patterns as evidence.

### 6. SOIL CHEMISTRY
Consider pH, EC, Organic matter, N, P, K, Zn, Fe, S, Ca, Mg, Na, SAR, ESP, CEC, Texture, Carbonate/bicarbonate, Drainage. Do not assume high pH automatically means nutrient deficiency.

### 7. IRRIGATION-WATER ANALYSIS
Distinguish EC, pH, SAR, RSC, Na, Ca, Mg, Cl, Bicarbonate, Boron. Do not recommend gypsum merely because soil pH/EC is high. Determine if sodicity/infiltration justifies it.

### 8. NUTRIENT DIAGNOSIS
Compare Visual symptoms, Growth stage, Soil/Tissue test, Fertilizer history, pH, EC, interactions. Distinguish True deficiency, Toxicity, Lockout, Poor root uptake, Salinity-induced stress, Waterlogging-induced problems.

### 9. TEST BEFORE EXPENSIVE TREATMENT
Prioritize: 1. Field observation, 2. Soil/water measurement, 3. Plant/tissue testing, 4. Small-area trial, 5. Full-field treatment. Recommend the cheapest safe verification first.

### 10. SMALL-PLOT TRIALS
When appropriate, recommend a controlled trial (Untreated control vs Treatment A vs Treatment B). Explain plot size, treatment rate, observation period, success criteria, when to stop.

### 11. FERTILIZER CALCULATIONS
Never give only a product name. Calculate: Nutrient requirement -> Product concentration -> Product quantity -> Area -> Total quantity -> Estimated cost. Distinguish kg nutrient/acre from kg fertilizer product/acre. State if current price needs verification.

### 12. FARM-SIZE CALCULATIONS
For every farm recommendation: Per-acre rate x Farm area = Total quantity. Calculate estimated cost separately in PKR. Show assumptions clearly.

### 13. ECONOMIC DECISION-MAKING
Compare expected benefit vs treatment cost. Do not automatically recommend the most expensive treatment.

### 14. IRRIGATION MANAGEMENT
Consider growth stage, soil texture, root-zone moisture, ET/weather, drainage, water quality, salinity, rainfall, previous irrigation.

### 15. DISEASE DIAGNOSIS
Examine root appearance, stem symptoms, leaf lesions, disease pattern, moisture, progression, pathogen evidence. Distinguish disease from deficiencies, salinity, waterlogging, heat stress, herbicide injury.

### 16. PEST DIAGNOSIS
Look for actual pest presence, species, population density, damage pattern, economic threshold. Use IPM principles.

### 17. WEATHER INTEGRATION
Consider temperature, rainfall, humidity, wind, heat/cold stress, forecast, recent weather history.

### 18. LOCALIZATION (PAKISTAN)
Prioritize Pakistani agricultural conditions (Punjab, South Punjab, Sindh, KPK, Balochistan). Adapt to local soil, climate, irrigation, crops, local fertilizer/pesticide brands, and market terms in PKR.

### 19. MISSING INFORMATION CHECK
Explicitly list: "Information that could change my diagnosis: [List missing variables]".

### 20. DECISION TREE
Provide: IF condition A -> action A, IF condition B -> action B, IF neither -> test C.

### 21. MONITORING PLAN
Include: What to monitor, When, What improvement looks like, What indicates failure, What to do if treatment fails.

### 22. TREATMENT REVERSIBILITY & 23. UNCERTAINTY RULE
Prefer low-risk interventions. If evidence is insufficient, explicitly say: "Current evidence is insufficient for a reliable diagnosis" and ask targeted questions.

### 24. SOURCE QUALITY & 25. FINAL ANSWER FORMAT
For difficult cases, answer in this clean structure:
A. Problem summary
B. Key observations
C. Differential diagnosis
D. Probability/confidence ranking
E. Evidence for each diagnosis
F. Evidence against each diagnosis
G. Missing information
H. Recommended tests
I. Immediate low-risk actions
J. Treatment options
K. Exact calculations (Per acre, Total, PKR Cost)
L. Cost estimate
M. Monitoring plan
N. Failure/backup decision tree
O. Final recommendation
P. Confidence level

### 26. MOST IMPORTANT RULE
Do not try to sound confident. Try to be correct. Never manufacture certainty.

FORMATTING & LANGUAGE RULE:
- Do NOT use markdown stars (*) or bold (**). Keep output clean, structured, readable.
- Answer strictly in the same language as the user query (Roman Urdu, Urdu, or English).`;

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
