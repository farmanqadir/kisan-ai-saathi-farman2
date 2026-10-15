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

    // Direct official Google Gemini 3.8 Flash endpoint
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`;

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
      return res.status(200).json({ reply: `API Error: ${data.error.message}` });
    }

    return res.status(200).json({ reply: "Response nahi mil saka. Phir se try karein." });

  } catch (err) {
    return res.status(200).json({ reply: "Server exception error: " + err.message });
  }
}
