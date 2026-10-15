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

    // Extract user question
    const rawMsg = messages[messages.length - 1]?.content || "Hello";
    const cleanUserMsg = typeof rawMsg === 'string' ? rawMsg.replace(/\[SYSTEM INSTRUCTION:.*?\]/g, '').trim() : "Hello";

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

    const priorityOrder = [
      "gemini-3.8-flash",
      "gemini-3.6-flash",
      "gemini-3.5-flash-lite",
      "gemini-2.0-flash"
    ];

    let modelsToTry = priorityOrder.filter(m => availableModels.includes(m));
    if (modelsToTry.length === 0) {
      modelsToTry = availableModels.length > 0 ? availableModels : ["gemini-3.8-flash", "gemini-3.5-flash-lite"];
    }

    // STRICT INSTRUCTION FOR SHORT & CONCISE REPLIES
    const strictSystemPrompt = `You are Farman Kisan Hub AI Assistant. 
STRICT RULES:
1. Provide extremely concise, direct, and to-the-point answers.
2. Do NOT write unnecessary intros, long explanations, or repetitive disclaimers.
3. Answer strictly in the same language as the user query (Roman Urdu, Urdu, or English).
4. Use bullet points only if necessary for clarity. Keep responses short and fast to read.`;

    let replyText = null;
    let lastError = "";

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
        } else if (data?.error?.message) {
          lastError = data.error.message;
        }
      } catch (err) {
        lastError = err.message;
      }
    }

    if (replyText) {
      return res.status(200).json({ reply: replyText });
    }

    return res.status(200).json({ reply: "Service error. Please try again." });

  } catch (err) {
    return res.status(200).json({ reply: "Server exception error: " + err.message });
  }
}
