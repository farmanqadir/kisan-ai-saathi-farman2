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
      return res.status(200).json({ reply: "Error: GEMINI_API_KEY missing in Vercel." });
    }

    // Format chat history for Gemini API (ChatGPT style memory support)
    const formattedContents = messages.map(msg => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }]
    }));

    const strictSystemPrompt = `You are Farman Kisan Hub AI Assistant. 
STRICT RULES:
1. Provide concise, direct, and exact answers.
2. NEVER use markdown characters like stars (*), double stars (**), or hashtags (#). Use clean plain text only.
3. Remember previous conversation context and answer accordingly.
4. Answer strictly in the same language as the user query (Roman Urdu, Urdu, or English).`;

    // Inject system instructions into the first message or prepend
    if (formattedContents.length > 0) {
      formattedContents[0].parts[0].text = `${strictSystemPrompt}\n\nUser: ${formattedContents[0].parts[0].text}`;
    }

    const modelsToTry = [
      "gemini-1.5-flash",
      "gemini-2.0-flash",
      "gemini-1.5-pro"
    ];

    let replyText = null;

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
        }
      } catch (err) {
        continue;
      }
    }

    if (replyText) {
      let cleanReply = replyText.replace(/[*#_]/g, '').trim();
      return res.status(200).json({ reply: cleanReply });
    }

    return res.status(200).json({ reply: "Aap ka jawab taiyar hai, kripya dobara try karein." });

  } catch (err) {
    return res.status(200).json({ reply: "Server error: " + err.message });
  }
}
