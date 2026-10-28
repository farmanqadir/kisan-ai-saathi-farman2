const VERSION = "v22-multimodal-production-ready";

// Multimodal Vision-Capable Models Array
const MODELS = [
  "gemini-2.5-flash",
  "gemini-1.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash",
];

const PER_MODEL_TIMEOUT_MS = 7000;
const MAX_MESSAGE_CHARS = 10000;
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB limit
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
const MAX_HISTORY = 6;
const OFF_TOPIC_TAG = "OFF_TOPIC";
const OFF_TOPIC_MESSAGE = "Please ask questions related to agriculture only.";

const SYSTEM_PROMPT = `EXPERT AGRICULTURAL DIAGNOSTIC & MULTIMODAL AI SYSTEM (PAKISTAN FOCUS)

You are a senior, evidence-based agricultural diagnostic AI working specifically for Pakistani farmers (Punjab, South Punjab, Sindh, KPK, Balochistan).

STRICT MULTILINGUAL CONSISTENCY (CRITICAL):
- DETECT THE LANGUAGE OF THE USER'S QUERY.
- IF ENGLISH -> RESPOND 100% IN SIMPLE ENGLISH.
- IF ROMAN URDU -> RESPOND STRICTLY IN ROMAN URDU.
- IF URDU SCRIPT -> RESPOND STRICTLY IN URDU SCRIPT.
- DO NOT MIX LANGUAGES. NEVER USE UNNECESSARY ENGLISH JARGON IN URDU/ROMAN URDU.

SCOPE RULE:
- You ONLY answer questions related to agriculture, farming, crops, livestock, soil, fertilizers, pesticides, plant diseases, irrigation, weather, and farm machinery.
- If user greets (hi, hello, salam), respond warmly in 1 short line.
- If message is completely UNRELATED to farming, reply strictly with ONLY: ${OFF_TOPIC_TAG}

MULTIMODAL / CROP IMAGE ANALYSIS PROTOCOL (DEFECT 1 & 3):
- When an image is attached, carefully inspect leaves, stems, roots, fruit, lesions, color changes, and pest presence.
- Describe key visual symptoms observed in the image before giving a diagnosis.
- If the image is blurry, dark, distant, or insufficient, explicitly ask for a better close-up picture or additional field information.

STRUCTURED DIAGNOSTIC & ADVISORY PROTOCOL (DEFECT 12):
Format your response using these clean Markdown headers:

1. Crop and Problem Summary
2. Most Likely Causes (Differential Diagnosis: list top 2-3 probabilities with supporting and opposing evidence)
3. Evidence and Uncertainty (State Confidence Level: High, Medium, or Low without faking certainty)
4. Additional Checks & Verification (Recommend the cheapest, safest physical check first)
5. Recommended Next Steps (Prioritize Integrated Pest Management; calculate exact per-acre & total PKR costs when farm size is provided)
6. Safety Precautions (Approved Pakistani pesticides/labels only, personal protective equipment, safety advice)
7. References & Sources (Credible agricultural research sources when available)

PESTICIDE & CHEMICAL SAFETY GUARDRAILS (DEFECT 4):
- Never invent chemical doses or unapproved schedules.
- Always recommend Integrated Pest Management (IPM) physical/cultural controls first.
- Recommending chemical sprays requires high diagnostic confidence. Otherwise, suggest physical checks or local agricultural extension verification.`;

function validateImageData(image) {
  if (!image || !image.data || !image.mimeType) return null;
  const mime = String(image.mimeType).toLowerCase();
  if (!ALLOWED_MIME_TYPES.includes(mime)) {
    throw new Error("Unsupported image format. Please upload JPG, JPEG, PNG, or WEBP.");
  }
  const bufferLength = Math.ceil((image.data.length * 3) / 4);
  if (bufferLength > MAX_IMAGE_SIZE_BYTES) {
    throw new Error("Image file size too large. Maximum limit is 10MB.");
  }
  return {
    inlineData: {
      mimeType: mime === "image/jpg" ? "image/jpeg" : mime,
      data: image.data.replace(/^data:image\/\w+;base64,/, ""),
    },
  };
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
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  // Health Check Endpoint (Defect 19)
  if (req.method === "GET") {
    return res.status(200).json({
      status: "healthy",
      service: "Farman Kisan Hub AI Diagnostic Engine",
      version: VERSION,
      models: MODELS,
      timestamp: new Date().toISOString(),
    });
  }

  if (req.method !== "POST") {
    return res.status(200).json({ reply: "Invalid request method." });
  }

  const startTime = Date.now();
  const requestId = "req_" + Math.random().toString(36).substring(2, 9);

  try {
    let body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const rawMessages = body?.messages;
    const imagePayload = body?.image; // Multimodal image payload

    if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
      return res.status(200).json({ reply: "Please provide a question or crop image." });
    }

    // Process & Validate Image (Defect 1, 2 & 18)
    let validatedImagePart = null;
    if (imagePayload) {
      try {
        validatedImagePart = validateImageData(imagePayload);
      } catch (imgErr) {
        return res.status(200).json({
          reply: `Image Processing Error: ${imgErr.message}`,
          requestId: requestId,
        });
      }
    }

    const messages = [];
    for (const m of rawMessages) {
      if (!m || typeof m !== "object") continue;
      const role = m.role === "user" ? "user" : "model";
      const content = typeof m.content === "string" ? m.content.trim() : "";
      if (content) messages.push({ role, content: content.slice(0, MAX_MESSAGE_CHARS) });
    }

    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.role !== "user") {
      return res.status(200).json({ reply: "Please ask a question or attach an image." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(200).json({ reply: "Configuration Error: API Key missing in Vercel backend." });
    }

    const history = messages.slice(-MAX_HISTORY);
    while (history.length && history[0].role !== "user") history.shift();

    const formattedContents = history.map((msg) => ({
      role: msg.role,
      parts: [{ text: msg.content }],
    }));

    // Attach Base64 Image to the last user message for Multimodal Vision models
    if (validatedImagePart && formattedContents.length > 0) {
      const lastFormatted = formattedContents[formattedContents.length - 1];
      lastFormatted.parts.unshift(validatedImagePart);
    }

    let result = null;
    let usedModel = null;
    const errors = [];

    for (const model of MODELS) {
      const attempt = await callSingleModel(model, apiKey, formattedContents, SYSTEM_PROMPT, 850);
      if (attempt.ok) {
        result = attempt;
        usedModel = model;
        break;
      }
      errors.push(`${model}: ${attempt.err}`);
    }

    if (!result) {
      return res.status(200).json({
        reply: "AI Diagnostic server is temporarily busy. Please retry in a few seconds.",
        debug: errors.join(" || "),
        requestId: requestId,
        tookMs: Date.now() - startTime,
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
      hasImage: !!validatedImagePart,
      tokens: {
        prompt: result.usage?.promptTokenCount || 0,
        answer: result.usage?.candidatesTokenCount || 0,
        total: result.usage?.totalTokenCount || 0,
      },
      model: usedModel,
      requestId: requestId,
      tookMs: Date.now() - startTime,
      version: VERSION,
    });
  } catch (err) {
    return res.status(200).json({ reply: "Server processing error: " + err.message, requestId: requestId });
  }
};
