import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  // Set headers first to ensure any response is handled properly
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(200).json({ reply: "Error: Invalid request method." });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const messages = body?.messages;

    if (!messages || !Array.isArray(messages)) {
      return res.status(200).json({ reply: "Error: Messages array missing in request." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(200).json({ 
        reply: "Configuration Error: Vercel environment variables mein GEMINI_API_KEY set nahi ki gayi hai." 
      });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const lastUserMsg = messages[messages.length - 1]?.content || "Hello";

    const chat = model.startChat({
      history: messages.slice(0, -1).map(m => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }]
      }))
    });

    const result = await chat.sendMessage(lastUserMsg);
    const responseText = await result.response.text();

    return res.status(200).json({ reply: responseText });

  } catch (err) {
    console.error("Critical Backend Error:", err.message);
    return res.status(200).json({ 
      reply: "Technical Error: " + (err.message || "Something went wrong on server.") 
    });
  }
}
