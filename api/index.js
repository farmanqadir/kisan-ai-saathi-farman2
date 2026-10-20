const VERSION = "v5-validation-tokens";

const MODELS = [
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
];

// ---------- SETTINGS ----------
const ANSWER_TOKENS = 300;          // (3) Answer tokens limit
const MAX_MESSAGE_CHARS = 1000;     // (1) Validation: ek message mein max characters
const MAX_HISTORY = 20;             // AI ko sirf last 20 messages bhejte hain (fast + kam tokens)
const OFF_TOPIC_TAG = "OFF_TOPIC";  // (2) AI ye tag bhejta hai jab sawal agriculture ka na ho
const OFF_TOPIC_MESSAGE = "Please ask questions related to agriculture only.";

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

    // Sirf sahi messages rakho (sahi role + khali na ho)
    const messages = [];
    for (const m of rawMessages) {
      if (!m || typeof m !== "object") continue;
      const role =
        m.role === "user" ? "user" :
        (m.role === "assistant" || m.role === "model") ? "model" : null;
      if (!role) continue;
      const content = typeof m.content === "string" ? m.content.trim() : "";
      if (!content) continue;
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

    // Sirf last N messages, aur pehla message user ka hona chahiye (Gemini ka rule)
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

    // ================= GEMINI CALL =================
    let replyText = null;
    let usage = null;
    let usedModel = null;
    const errors = [];

    for (const model of MODELS) {
      try {
        const is25 = model.startsWith("gemini-2.5");
        const generationConfig = {
          temperature: 0.4,
          // 3.x models apne thinking tokens bhi isi limit mein ginte hain, is liye unhe zyada room
          maxOutputTokens: is25 ? ANSWER_TOKENS : ANSWER_TOKENS * 4,
        };
        if (is25) generationConfig.thinkingConfig = { thinkingBudget: 0 };

        const url =
          "https://generativelanguage.googleapis.com/v1beta/models/" +
          model + ":generateContent?key=" + apiKey;

        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: formattedContents,
            generationConfig: generationConfig,
          }),
        });

        const data = await response.json();
        const parts = data?.candidates?.[0]?.content?.parts || [];
        const text = parts.map((p) => p.text || "").join("").trim();

        if (response.ok && text) {
          replyText = text;
          usage = data.usageMetadata || null;
          usedModel = model;
          break;
        }

        if (data?.error?.message) {
          errors.push(model + ": " + data.error.message.slice(0, 300));
        } else {
          errors.push(
            model + ": empty reply (" + (data?.candidates?.[0]?.finishReason || "no candidates") + ")"
          );
        }
      } catch (err) {
        errors.push(model + ": " + err.message);
      }
    }

    if (!replyText) {
      return res.status(200).json({
        reply: errors.length ? "API Error: " + errors.join(" || ") : "Server busy. Please try again.",
      });
    }

    // ================= (2) IRRELEVANT QUESTION CHECK =================
    let cleanReply = replyText
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
      version: VERSION,
    });
  } catch (err) {
    return res.status(200).json({ reply: "Server exception error: " + err.message });
  }
};
