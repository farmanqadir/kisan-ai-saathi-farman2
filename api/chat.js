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

    const strictSystemPrompt = `You are Farman Kisan Hub AI Assistant. 
STRICT RULES:
1. Provide extremely short, concise, direct, and exact answers (maximum 2 to 4 sentences).
2. NEVER use markdown characters like stars (*), double stars (**), or hashtags (#). Use clean plain text only.
3. Remember previous conversation context and answer accordingly.
4. Answer strictly in the same language as the user query (Roman Urdu, Urdu, or English).`;

    let formattedContents = messages.map(msg => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }]
    }));

    if (formattedContents.length > 0 && formattedContents[0].parts && formattedContents[0].parts[0]) {
      formattedContents[0].parts[0].text = `${strictSystemPrompt}\n\nUser Question: ${formattedContents[0].parts[0].text}`;
    }

    // Dynamic Discovery of Active Google Models to prevent any 404/not found errors
    let modelsToTry = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-pro"];
    try {
      const listUrl = `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`;
      const listRes = await fetch(listUrl);
      const listData = await listRes.json();

      if (listData?.models && Array.isArray(listData.models)) {
        const discovered = listData.models
          .filter(m => m.supportedGenerationMethods?.includes("generateContent"))
          .map(m => m.name.replace("models/", ""));
        
        if (discovered.length > 0) {
          modelsToTry = [...new Set([...discovered, ...modelsToTry])];
        }
      }
    } catch (e) {
      console.error("Discovery error:", e);
    }

    let replyText = null;
    let lastError = "";

    for (const model of modelsToTry) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`;
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

    return res.status(200).json({ reply: "API Error: " + (lastError || "All models busy.") });

  } catch (err) {
    return res.status(200).json({ reply: "Server exception error: " + err.message });
  }
};
