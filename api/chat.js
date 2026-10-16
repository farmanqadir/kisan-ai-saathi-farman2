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
    const isCall = body?.isCall || false;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(200).json({ reply: "Request format error." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(200).json({ reply: "Configuration Error: GEMINI_API_KEY missing in Vercel." });
    }

    const systemInstruction = {
      parts: [{
        text: isCall 
          ? "You are Farman Kisan Hub Voice Assistant. Provide a complete, natural 1-2 sentence response. Reply strictly in the language used by the user (Urdu, Roman Urdu, or English). Clean plain text only."
          : "You are Farman Kisan Hub AI Assistant, an expert agricultural advisor. Give complete, direct, concise answers (2 to 4 full sentences). Do NOT use markdown asterisks or hashtags. Answer strictly in the language of query."
      }]
    };

    const formattedContents = messages.map(msg => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }]
    }));

    const modelsToTry = ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite"];

    let replyText = null;

    for (const model of modelsToTry) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: systemInstruction,
            contents: formattedContents,
            generationConfig: {
              maxOutputTokens: 1000,
              temperature: 0.4
            }
          })
        });

        const data = await response.json();

        if (response.ok && data?.candidates?.[0]?.content?.parts?.[0]?.text) {
          replyText = data.candidates[0].content.parts[0].text;
          break;
        }
      } catch (err) {
        console.error(err);
      }
    }

    if (replyText) {
      const cleanReply = replyText.replace(/[*#]/g, '').trim();
      return res.status(200).json({ reply: cleanReply });
    }

    return res.status(200).json({ reply: "Maazrat, dobara koshish karein." });

  } catch (err) {
    return res.status(200).json({ reply: "Server error: " + err.message });
  }
};
