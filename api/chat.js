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
      return res.status(200).json({ reply: "Request format incorrect." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(200).json({ reply: "Error: Vercel environment variables mein GEMINI_API_KEY set nahi hai." });
    }

    const lastUserMsg = messages[messages.length - 1]?.content || "Hello";

    // Standard Gemini REST endpoints to try
    const endpoints = [
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`
    ];

    let lastErrorDetails = "";

    for (const url of endpoints) {
      try {
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
        } else if (data.error) {
          lastErrorDetails = data.error.message || JSON.stringify(data.error);
        }
      } catch (err) {
        lastErrorDetails = err.message;
      }
    }

    // Exact Error Feedback if Google API declines request
    return res.status(200).json({ 
      reply: `Google API Error: ${lastErrorDetails || "Response fetch nahi ho saka. Baraye meherbani API key permissions ya billing check karein."}` 
    });

  } catch (err) {
    return res.status(200).json({ reply: "Server error: " + err.message });
  }
}
