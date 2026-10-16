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
          ? "You are Farman Kisan Hub Voice Assistant. Answer in MAXIMUM 1 SHORT SENTENCE. Reply EXACTLY in the language spoken by user (Urdu, English, or Roman Urdu). No markdown, no filler words."
          : "You are Farman Kisan Hub AI Assistant, an expert agricultural advisor. Give concise, direct answers (max 2-4 sentences). Do NOT use markdown symbols. Answer strictly in the language of query."
      }]
    };

    const formattedContents = messages.map(msg => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }]
    }));

    // For live call, use ultra-fast model priority
    const modelsToTry = isCall 
      ? ["gemini-3.5-flash-lite", "gemini-3.8-flash"]
      : ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite"];

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
              maxOutputTokens: isCall ? 60 : 300, // Reduced tokens for instant call speed
              temperature: 0.3
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

    return res.status(200).json({ reply: "Aap ki baat samajh nahi aayi." });

  } catch (err) {
    return res.status(200).json({ reply: "Error: " + err.message });
  }
};
