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
          text: "You are Farman Kisan Hub AI Assistant, an expert agricultural advisor. Give extremely short, concise, accurate, and direct answers (maximum 2 to 4 sentences). Never output internal reasoning. Do NOT use markdown. Answer in the same language as the user (Roman Urdu, Urdu, or English).",
        },
      ],
    };

    const formattedContents = messages.map((msg) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));

    const modelsToTry = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"];

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
            systemInstruction,
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
