module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(200).json({ reply: "Invalid request method." });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const messages = body?.messages;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(200).json({ reply: "Request format error." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(200).json({ reply: "Configuration Error: GEMINI_API_KEY missing in Vercel." });
    }

    // Professional Agriculture Assistant System Prompt
    const systemInstructionText = "You are Farman Kisan Hub AI Assistant, an expert agricultural advisor. Provide extremely short, concise, and direct answers (maximum 2 to 4 sentences). Never use markdown characters like stars, bold, or hashtags. Remember previous conversation history and answer strictly in the same language as the user query (Roman Urdu, Urdu, or English).";

    // Map conversation history properly for ChatGPT-style memory
    const formattedContents = messages.map(msg => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }]
    }));

    // Working models fallback list
    const modelsToTry = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-pro"];

    let replyText = null;
    let lastError = "";

    for (const model of modelsToTry) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`;
        
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: {
              parts: [{ text: systemInstructionText }]
            },
            contents: formattedContents
          })
        });

        const data = await response.json();

        if (response.ok && data?.candidates?.[0]?.content?.parts?.[0]?.text) {
          replyText = data.candidates[0].content.parts[0].text;
          break;
        } else if (data?.error?.message) {
          lastError = data.error.message;
        }
      } catch (err) {
        lastError = err.message;
      }
    }

    if (replyText) {
      const cleanReply = replyText
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/#/g, '')
        .trim();

      return res.status(200).json({ reply: cleanReply });
    }

    return res.status(200).json({ reply: "Maazrat, abhi server busy hai. Baraye meherbani dobara koshish karein." });

  } catch (err) {
    return res.status(200).json({ reply: "Server exception error: " + err.message });
  }
};
