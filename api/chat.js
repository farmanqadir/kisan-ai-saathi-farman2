import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  // Always return JSON headers
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Invalid request payload" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(200).json({ 
        reply: "System Error: GEMINI_API_KEY Vercel Environment Variables mein configure nahi ki gayi." 
      });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    // Correct SDK method: getGenerativeModel
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const lastUserMsg = messages[messages.length - 1]?.content || "";

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), 10000)
    );

    const apiPromise = model.generateContent(lastUserMsg);
    const result = await Promise.race([apiPromise, timeoutPromise]);
    const responseText = await result.response.text();

    return res.status(200).json({ reply: responseText });

  } catch (err) {
    console.error("Gemini API Error:", err);
    return res.status(200).json({ 
      reply: "Maazrat, server busy hone ki wajah se response nahi mil saka. Baraye meherbani dobara koshish karein." 
    });
  }
}
