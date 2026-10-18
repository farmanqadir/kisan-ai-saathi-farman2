module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(200).json({ reply: "Invalid request method." });
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

    const modelsToTry = [
      "gemini-3.8-flash",
      "gemini-3.6-flash",
      "gemini-3.5-flash-lite",
      "gemini-2.0-flash",
      "gemini-2.0-flash-lite",
    ];

    let replyText = null;
    let rawErrorDetails = "";

    for (const model of modelsToTry) {
      try {
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
          }),
        });

        const data = await response.json();

        if (response.ok && data?.candidates?.[0]?.content?.parts?.[0]?.text) {
          replyText = data.candidates[0].content.parts[0].text;
          break;
        } else if (data?.error?.message) {
          rawErrorDetails = data.error.message;
        }
      } catch (err) {
        rawErrorDetails = err.message;
      }
    }

    if (replyText) {
      const cleanReply = replyText
        .replace(/Role:.*?Final Result:/gs, "")
        .replace(/\*\*/g, "")
        .replace(/\*/g, "")
        .replace(/#/g, "")
        .trim();

      return res.status(200).json({ reply: cleanReply });
    }

    return res.status(200).json({
      reply: rawErrorDetails
        ? "API Error: " + rawErrorDetails
        : "Server busy. Please try again.",
    });
  } catch (err) {
    return res.status(200).json({ reply: "Server exception error: " + err.message });
  }
};
