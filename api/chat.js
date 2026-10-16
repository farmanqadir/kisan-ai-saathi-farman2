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

    // STRICT RULES FOR CONCISE, STAR-FREE, EXACT ANSWERS
    const strictSystemPrompt = `You are Farman Kisan Hub AI Assistant. 
STRICT RULES:
1. Provide extremely short, concise, direct, and exact answers (maximum 2 to 4 sentences).
2. NEVER use markdown characters like stars (*), double stars (**), bullet stars (*), or hashtags (#). Use clean plain text only.
3. Remember previous conversation context and answer accordingly.
4. Answer strictly in the same language as the user query (Roman Urdu, Urdu, or English).`;

    // Map conversation history for ChatGPT-style memory
    let formattedContents = messages.map(msg => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }]
    }));

    if (formattedContents.length > 0 && formattedContents[0].parts && formattedContents[0].parts[0]) {
      formattedContents[0].parts[0].text = `${strictSystemPrompt}\n\nUser Question: ${formattedContents[0].parts[0].text}`;
    }

    // Direct stable model endpoint to eliminate lookup errors and traffic delays
    const model = "gemini-1.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: formattedContents })
    });

    const data = await response.json();

    if (response.ok && data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      const replyText = data.candidates[0].content.parts[0].text;
      const cleanReply = replyText
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/#/g, '')
        .trim();

      return res.status(200).json({ reply: cleanReply });
    } else {
      const errMessage = data?.error?.message || "Server busy";
      return res.status(200).json({ reply: "API Error: " + errMessage });
    }

  } catch (err) {
    return res.status(200).json({ reply: "Server exception error: " + err.message });
  }
};
