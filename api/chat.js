import { GoogleGenAI } from '@google/genai';

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

    if (!messages || messages.length === 0) {
      return res.status(200).json({ reply: "Request format error." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(200).json({ reply: "Configuration Error: GEMINI_API_KEY missing in Vercel." });
    }

    // Official Google GenAI SDK Client
    const ai = new GoogleGenAI({ apiKey });

    // Chat History formatting for full memory
    const contents = messages.map(msg => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }]
    }));

    const systemInstruction = `You are Farman Kisan Hub AI Assistant. 
STRICT RULES:
1. Provide concise, direct, and exact answers (2-4 sentences).
2. NEVER use markdown characters like stars (*), double stars (**), or hashtags (#). Use clean plain text only.
3. Remember previous conversation context and answer accordingly.
4. Answer strictly in the same language as the user query (Roman Urdu, Urdu, or English).`;

    // Official SDK API Call
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
      }
    });

    if (response && response.text) {
      let cleanReply = response.text.replace(/[*#_]/g, '').trim();
      return res.status(200).json({ reply: cleanReply });
    } else {
      return res.status(200).json({ reply: "Aap ka jawab taiyar hai, kripya dobara try karein." });
    }

  } catch (err) {
    return res.status(200).json({ reply: "API Error: " + err.message });
  }
}
