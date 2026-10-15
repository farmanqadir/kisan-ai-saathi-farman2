import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Invalid request payload" });
    }

    // Gemini API Setup
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "API Key configure nahi hai." });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Updated to Gemini 2.5 Flash (Ultra fast & High quota limit)
    const model = genAI.getGenerativeAIModel({ model: "gemini-2.5-flash" });

    // Extract prompt from conversation
    const lastUserMsg = messages[messages.length - 1]?.content || "";

    // Set 8-second timeout prevent hanging
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Response limit reached, please try again")), 8000)
    );

    const apiPromise = model.generateContent(lastUserMsg);

    const result = await Promise.race([apiPromise, timeoutPromise]);
    const responseText = await result.response.text();

    return res.status(200).json({ reply: responseText });

  } catch (err) {
    console.error("Gemini Error:", err);
    // Automatic fallback error message (never hangs the client)
    return res.status(200).json({ 
      reply: "Maazrat, network slow hone ki wajah se response delay ho gaya. Baraye meherbani dobara click karein." 
    });
  }
}
