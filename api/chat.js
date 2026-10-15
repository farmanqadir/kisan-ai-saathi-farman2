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
      return res.status(200).json({ reply: "Request format error: No messages provided." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(200).json({ reply: "Configuration Error: GEMINI_API_KEY missing in Vercel environment variables." });
    }

    // Extract cleanest user text
    const rawMsg = messages[messages.length - 1]?.content || "Hello";
    const cleanUserMsg = typeof rawMsg === 'string' ? rawMsg.replace(/\[SYSTEM INSTRUCTION:.*?\]/g, '').trim() : "Hello";

    // Most stable free-tier active models
    const modelsToTry = [
      "gemini-2.0-flash",
      "gemini-1.5-flash",
      "gemini-1.5-pro"
    ];

    let replyText = null;
    let lastErrorDetails = "";

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
                parts: [{ text: `Aap Farman Kisan Hub ke AI Assistant hain. Urdu/English/Roman Urdu mein Kisan ke is sawal ka jawab dein: ${cleanUserMsg}` }]
              }
            ]
          })
        });

        const data = await response.json();

        if (response.ok && data?.candidates?.[0]?.content?.parts?.[0]?.text) {
          replyText = data.candidates[0].content.parts[0].text;
          break;
        } else if (data?.error) {
          lastErrorDetails = `[${model}]: ${data.error.message || JSON.stringify(data.error)}`;
        }
      } catch (err) {
        lastErrorDetails = err.message;
      }
    }

    if (replyText) {
      return res.status(200).json({ reply: replyText });
    }

    return res.status(200).json({ reply: `Google API Response: ${lastErrorDetails || "Quota exceeded or temporary network lag. Please try again."}` });

  } catch (err) {
    return res.status(200).json({ reply: "Server exception error: " + err.message });
  }
}
