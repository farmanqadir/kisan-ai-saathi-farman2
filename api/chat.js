export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(200).json({ reply: "Invalid request method." });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const messages = body?.messages || [];
    const userMsg = messages[messages.length - 1]?.content || "Hello";

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(200).json({ reply: "Error: GEMINI_API_KEY missing in Vercel." });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: `You are Farman Kisan Hub AI Assistant. Answer concisely in 2-4 sentences in the same language without markdown stars. Query: ${userMsg}` }]
        }]
      })
    });

    const data = await response.json();
    
    if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      let text = data.candidates[0].content.parts[0].text;
      text = text.replace(/[*#_]/g, '').trim();
      return res.status(200).json({ reply: text });
    } else {
      return res.status(200).json({ reply: "Aap ka jawab taiyar hai, kripya dobara try karein." });
    }

  } catch (err) {
    return res.status(200).json({ reply: "Server error: " + err.message });
  }
}
