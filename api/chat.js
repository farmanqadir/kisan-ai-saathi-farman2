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

    // Map conversation history properly like ChatGPT style memory
    let formattedContents = messages.map(msg => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }]
    }));

    // Inject system instructions neatly into the very first user prompt
    if (formattedContents.length > 0 && formattedContents[0].parts && formattedContents[0].parts[0]) {
      formattedContents[0].parts[0].text = `${strictSystemPrompt}\n\nUser Question: ${formattedContents[0].parts[0].text}`;
    }

    // Dynamic Discovery of Active Google Models
    let availableModels = [];
    try {
      const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
      const listRes = await fetch(listUrl);
      const listData = await listRes.json();

      if (listData?.models && Array.isArray(listData.models)) {
        availableModels = listData.models
          .filter(m => m.supportedGenerationMethods?.includes("generateContent"))
          .map(m => m.name.replace("models/", ""));
      }
    } catch (e) {
      console.error("List models fetch error:", e);
    }

    // Priority models list (including your preferred flash models)
    const priorityOrder = [
      "gemini-3.8-flash",
      "gemini-3.6-flash",
      "gemini-3.5-flash-lite",
      "gemini-2.0-flash",
      "gemini-2.5-flash",
      "gemini-1.5-flash"
    ];

    let modelsToTry = priorityOrder.filter(m => availableModels.includes(m));
    if (modelsToTry.length === 0) {
      modelsToTry = availableModels.length > 0 ? availableModels : priorityOrder;
    }

    let replyText = null;
    let lastError = "";

    // Loop through available working models with full history fallback
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
      }
    }

    if (replyText) {
      // Clean any markdown stars or formatting symbols automatically
      const cleanReply = replyText
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/#/g, '')
        .trim();

      return res.status(200).json({ reply: cleanReply });
    }

    return res.status(200).json({ reply: "Maazrat, abhi tamam AI models par high traffic hai. Baraye meherbani thori der baad dobara koshish karein." });

  } catch (err) {
    return res.status(200).json({ reply: "Server exception error: " + err.message });
  }
};
