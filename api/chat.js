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
      return res.status(200).json({ reply: "No messages found in request." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(200).json({ reply: "Error: GEMINI_API_KEY is not set in Vercel Environment Variables." });
    }

    const lastUserMsg = messages[messages.length - 1]?.content || "Hello";

    // Standard primary and secondary model endpoints
    const models = ["gemini-1.5-flash", "gemini-1.5-pro"];
    let replyText = "";

    for (const model of models) {
      try {
        const geminiURL = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const response = await fetch(geminiURL, {
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
        }
      } catch (err) {
        console.log(`Failed with model ${model}, trying next...`);
      }
    }

    if (!replyText) {
      replyText = "Kisaan bhai, server busy hone ki wajah se response nahi mil saka. Baraye meherbani thori der baad dobara koshish karein.";
    }

    return res.status(200).json({ reply: replyText });

  } catch (err) {
    return res.status(200).json({ reply: "Server error occurred. Please try again." });
  }
}
