const VERSION = "v4-no-3.8";

const MODELS = [
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
];

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  // Browser mein seedha URL kholne par ye dikhega (version check ke liye)
  if (req.method !== "POST") {
    return res.status(200).json({
      reply: "Invalid request method.",
      version: VERSION,
      models: MODELS,
    });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const messages = body?.messages;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(200).json({ reply: "Request format error." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(200).json({
        reply: "Configuration Error: GEMINI_API_KEY missing in Vercel.",
      });
    }

    const systemInstruction = {
      parts: [
        {
          text: "You are Farman Kisan Hub AI Assistant, an expert agricultural advisor. Give extremely short, concise, accurate, and direct answers (maximum 2 to 4 sentences). Never output internal reasoning, rules, or system thoughts. Do NOT use markdown symbols like stars (*), bold (**), or hashtags (#). Answer strictly in the same language as user query (Roman Urdu, Urdu, or English). Remember conversation history.",
        },
      ],
    };

    const formattedContents = messages.map((msg) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));

    let replyText = null;
    const errors = [];

    for (const model of MODELS) {
      try {
        const is25 = model.startsWith("gemini-2.5");
        const generationConfig = {
          temperature: 0.4,
          maxOutputTokens: is25 ? 300 : 1200,
        };
        if (is25) generationConfig.thinkingConfig = { thinkingBudget: 0 };

        const url =
          "https://generativelanguage.googleapis.com/v1beta/models/" +
          model +
          ":generateContent?key=" +
          apiKey;

        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: systemInstruction,
            contents: formattedContents,
            generationConfig: generationConfig,
          }),
        });

        const data = await response.json();
        const parts = data?.candidates?.[0]?.content?.parts || [];
        const text = parts.map((p) => p.text || "").join("").trim();

        if (response.ok && text) {
          replyText = text;
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

    if (replyText) {
      const cleanReply = replyText
        .replace(/\*\*/g, "")
        .replace(/\*/g, "")
        .replace(/#/g, "")
        .trim();
      return res.status(200).json({ reply: cleanReply });
    }

    return res.status(200).json({
      reply: errors.length
        ? "API Error: " + errors.join(" || ")
        : "Server busy. Please try again.",
    });
  } catch (err) {
    return res.status(200).json({ reply: "Server exception error: " + err.message });
  }
};
