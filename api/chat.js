export default async function handler(req, res) {
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

    const rawMsg = messages[messages.length - 1]?.content || "Hello";
    const cleanUserMsg = typeof rawMsg === 'string' ? rawMsg.replace(/\[SYSTEM INSTRUCTION:.*?\]/g, '').trim() : "Hello";

    const modelsToTry = [
      "gemini-2.0-flash",
      "gemini-1.5-flash"
    ];

    const strictSystemPrompt = `You are Farman Kisan Hub AI Assistant. 
STRICT RULES:
1. Provide extremely short, concise, direct, and exact answers (maximum 2 to 4 sentences).
2. NEVER use markdown characters like stars, double stars, or hashtags. Use clean plain text only.
3. No unnecessary intros or disclaimers.
4. Answer strictly in the same language as the user query (Roman Urdu, Urdu, or English).`;

    let replyText = null;

    for (const model of modelsToTry) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [{ text: `${strictSystemPrompt}\n\nUser Question: ${cleanUserMsg}` }]
              }
            ]
          })
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
      const cleanReply = replyText
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/#/g, '')
        .trim();

      return res.status(200).json({ reply: cleanReply });
    }

    return res.status(200).json({ reply: "Server busy, please try again." });

  } catch (err) {
    return res.status(200).json({ reply: "Server error: " + err.message });
  }
}
