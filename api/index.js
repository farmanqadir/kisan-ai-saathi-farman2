const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// Static files serve karne ke liye
app.use(express.static(__dirname));

// Root path routing
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Chat API Route
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, isCall } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(200).json({ reply: "Configuration Error: GEMINI_API_KEY missing." });
    }

    const systemInstruction = {
      parts: [{
        text: isCall 
          ? "You are Farman Kisan Hub Voice Assistant. Provide a complete, natural 1-2 sentence response. Never cut sentences in half. Reply strictly in the language used by the user (Urdu, Roman Urdu, or English). Clean plain text only."
          : "You are Farman Kisan Hub AI Assistant, an expert agricultural advisor. Give complete, direct, concise answers (2 to 4 full sentences). Never cut sentences halfway. Do NOT use markdown asterisks or hashtags. Answer strictly in the language of query."
      }]
    };

    const formattedContents = messages.map(msg => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }]
    }));

    const modelsToTry = ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite"];
    let replyText = null;

    for (const model of modelsToTry) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: systemInstruction,
            contents: formattedContents,
            generationConfig: { 
              maxOutputTokens: 2048, // Adhoore jawab ko khatam karne ke liye tokens barha diye hain
              temperature: 0.4 
            }
          })
        });

        const data = await response.json();
        if (response.ok && data?.candidates?.[0]?.content?.parts?.[0]?.text) {
          replyText = data.candidates[0].content.parts[0].text;
          break;
        }
      } catch (err) {
        console.error(err);
      }
    }

    if (replyText) {
      const cleanReply = replyText.replace(/[*#]/g, '').trim();
      return res.status(200).json({ reply: cleanReply });
    }

    return res.status(200).json({ reply: "Maazrat, dobara koshish karein." });
  } catch (err) {
    return res.status(200).json({ reply: "Server error: " + err.message });
  }
});

// Vercel serverless ke liye export
module.exports = app;
