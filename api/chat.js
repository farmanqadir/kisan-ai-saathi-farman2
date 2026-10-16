module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(200).json({ reply: "Invalid request method." });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const messages = body?.messages || [];

    if (!messages || messages.length === 0) {
      return res.status(200).json({ reply: "Request format error." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(200).json({ reply: "Configuration Error: GEMINI_API_KEY missing in Vercel." });
    }

    // Format chat history for full memory context
    const formattedContents = messages.map(msg => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }]
    }));

    const systemPrompt = "You are Farman Kisan Hub AI Assistant. Answer directly and concisely in 2-4 sentences in Roman Urdu, Urdu, or English without markdown stars (*). Remember conversation history.";

    if (formattedContents.length > 0) {
      formattedContents[0].parts[0].text = `${systemPrompt}\n\nUser Question: ${formattedContents[0].parts[0].text}`;
    }

    // Clean model names with standard hyphens
    const targetModel = "gemini-1.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(targetModel)}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: formattedContents })
    });

    const data = await response.json();

    if (response.ok && data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      let cleanReply = data.candidates[0].content.parts[0].text.replace(/[*#_]/g, '').trim();
      return res.status(200).json({ reply: cleanReply });
    } else {
      return res.status(200).json({ 
        reply: data?.error?.message ? `API Error: ${data.error.message}` : "Server busy, please try again." 
      });
    }

  } catch (err) {
    return res.status(200).json({ reply: "Server Connection Error: " + err.message });
  }
};
