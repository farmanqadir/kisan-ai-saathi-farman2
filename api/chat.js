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

    // ChatGPT-style full conversation memory mapping
    const formattedContents = messages.map(msg => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }]
    }));

    const systemPrompt = `You are Farman Kisan Hub AI Assistant. 
STRICT RULES:
1. Provide concise, direct, and exact answers (2-4 sentences).
2. NEVER use markdown characters like stars (*), double stars (**), or hashtags (#). Use clean plain text only.
3. Remember previous conversation context and answer accordingly.
4. Answer strictly in the same language as the user query (Roman Urdu, Urdu, or English).`;

    if (formattedContents.length > 0) {
      formattedContents[0].parts[0].text = `${systemPrompt}\n\nUser Question: ${formattedContents[0].parts[0].text}`;
    }

    // Direct official Google Gemini endpoint call
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

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
