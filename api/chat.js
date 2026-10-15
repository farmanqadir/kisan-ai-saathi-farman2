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

    if (!messages || !Array.isArray(messages)) {
      return res.status(200).json({ reply: "Request format error." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(200).json({ reply: "Configuration Error: GEMINI_API_KEY missing in Vercel." });
    }

    const lastUserMsg = messages[messages.length - 1]?.content || "Hello";

    // Step 1: Fetch active available models directly for your API key
    const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const listRes = await fetch(listUrl);
    const listData = await listRes.json();

    if (listData.error) {
      return res.status(200).json({ reply: `API Key Error: ${listData.error.message}` });
    }

    const availableModels = (listData.models || [])
      .filter(m => m.supportedGenerationMethods?.includes("generateContent"))
      .map(m => m.name.replace("models/", ""));

    if (availableModels.length === 0) {
      return res.status(200).json({ reply: "Is API Key ke saath koi valid text model link nahi hai." });
    }

    // Prioritize light & fast models first, then fallbacks
    const preferredOrder = [
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-1.5-flash",
      "gemini-1.0-pro"
    ];

    let targetModels = preferredOrder.filter(m => availableModels.includes(m));
    if (targetModels.length === 0) {
      targetModels = availableModels; // Fallback to any active model in your list
    }

    let replyText = null;
    let lastErr = "";

    // Step 2: Try models sequentially until one succeeds
    for (const model of targetModels) {
      try {
        const chatUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const response = await fetch(chatUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: lastUserMsg }] }]
          })
        });

        const data = await response.json();

        if (response.ok && data?.candidates?.[0]?.content?.parts?.[0]?.text) {
          replyText = data.candidates[0].content.parts[0].text;
          break;
        } else if (data.error) {
          lastErr = data.error.message;
        }
      } catch (err) {
        lastErr = err.message;
      }
    }

    if (replyText) {
      return res.status(200).json({ reply: replyText });
    }

    return res.status(200).json({ reply: `Server Error: ${lastErr || "Koshish nakam rahi. Kuch der baad try karein."}` });

  } catch (err) {
    return res.status(200).json({ reply: "Server exception error: " + err.message });
  }
}
