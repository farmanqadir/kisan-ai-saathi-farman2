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
      return res.status(200).json({ reply: "Configuration Error: GEMINI_API_KEY environment variable missing." });
    }

    const lastUserMsg = messages[messages.length - 1]?.content || "Hello";

    // 1. Pehle API key aur models ki availability test karne ke liye list models call karein
    let activeModel = "gemini-1.5-flash"; // default fallback
    try {
      const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      const listData = await listRes.json();
      
      if (listData && listData.models) {
        // Check if gemini-1.5-flash or flash exists in available models
        const foundFlash = listData.models.find(m => m.name.includes("gemini-1.5-flash") || m.name.includes("gemini-2.5-flash"));
        if (foundFlash) {
          // Extract clean model name without 'models/' prefix if needed
          activeModel = foundFlash.name.replace("models/", "");
        }
      }
    } catch (e) {
      console.log("Model listing check skipped, using default.");
    }

    // 2. Ab us verified model par request bhejain
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: lastUserMsg }] }]
      })
    });

    const data = await response.json();

    if (response.ok && data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      return res.status(200).json({ reply: data.candidates[0].content.parts[0].text });
    }

    if (data.error) {
      return res.status(200).json({ reply: `API Connection Error (${activeModel}): ${data.error.message}` });
    }

    return res.status(200).json({ reply: "Server se koi response nahi mila. Dobara koshish karein." });

  } catch (err) {
    return res.status(200).json({ reply: "Server exception error: " + err.message });
  }
}
