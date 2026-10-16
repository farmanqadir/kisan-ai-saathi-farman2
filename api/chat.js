export default async function handler(req, res) {
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

    // Full Chat Memory Mapping for Gemini
    const formattedContents = messages.map(msg => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }]
    }));

    const systemPrompt = "You are Farman Kisan Hub AI Assistant. Answer directly and concisely in 2-4 sentences in the same language without markdown stars (*). Remember chat context.";

    // Inject System Instruction into first user message
    if (formattedContents.length > 0) {
      formattedContents[0].parts[0].text = `${systemPrompt}\n\n${formattedContents[0].parts[0].text}`;
    }

    // Clean model identifiers (no typos)
    const modelsToTry = [
      "gemini-1.5-flash",
      "gemini-2.0-flash",
      "gemini-1.5-pro"
    ];

    let replyText = null;
    let lastError = null;

    for (const model of modelsToTry) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: formattedContents })
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
        continue;
      }
    }

    if (replyText) {
      let cleanReply = replyText.replace(/[*#_]/g, '').trim();
      return res.status(200).json({ reply: cleanReply });
    }

    return res.status(200).json({ 
      reply: lastError ? `API Error: ${lastError}` : "Server busy, please try again." 
    });

  } catch (err) {
    return res.status(200).json({ reply: "Server error: " + err.message });
  }
}
