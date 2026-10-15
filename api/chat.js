export default async function handler(req, res) {
  // Ensure headers are strictly JSON
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(200).json({ reply: "Invalid request method." });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const messages = body?.messages;

    if (!messages || !Array.isArray(messages)) {
      return res.status(200).json({ reply: "No messages found in request." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(200).json({ reply: "Error: GEMINI_API_KEY is not set in Vercel Environment Variables." });
    }

    // Get the latest user message
    const lastUserMsg = messages[messages.length - 1]?.content || "Hello";

    // Direct Gemini 1.5/2.5 Flash REST API endpoint (No external package crash risk)
    const geminiURL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(geminiURL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: lastUserMsg }]
          }
        ]
      })
    });

    const data = await response.json();

    if (data.error) {
      return res.status(200).json({ reply: "Gemini API Error: " + (data.error.message || "Unknown error") });
    }

    const replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "Maazrat, koi jawab mosool nahi ho saka.";

    return res.status(200).json({ reply: replyText });

  } catch (err) {
    console.error("Serverless Function Error:", err);
    return res.status(200).json({ reply: "Server error occurred. Please try again." });
  }
}
