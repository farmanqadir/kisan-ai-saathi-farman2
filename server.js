require("dotenv").config();
const express = require("express");
const path = require("path");

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const SYSTEM_PROMPT = `Aap "Kisan AI Saathi" hain, Pakistan ke kisanon ke liye ek zaheen aur hamdard zarai (agriculture) mushir.

ZABAN:
- Jawab hamesha usi zaban mein dein jis mein kisan sawal kare: Roman Urdu, Urdu ya English.
- Aasan lafz istemal karein.

AAP KIN MASAIL MEIN MADAD KARTE HAIN:
- Mausam aur season ke hisaab se fasal ka intikhab
- Beej ki qism, bijai ka waqt, zameen ki qism, khaad, paani, bimariyan, keeray, lagat, paidawar, mandi

JAWAB KA ANDAAZ:
1. Pehle seedha mukhtasar jawab, phir tafseel.
2. Fasal ke liye: bijai ka waqt, tayyar hone ki muddat, paani, lagat, paidawar, khatray.
3. Agar maloomat kam ho to 2-3 sawal poochein.

HIFAZAT:
- Dawa ka naam batayen to label parhne aur agriculture officer se confirm karne ko kahein.`;

const MAX_HISTORY = 20;

function cleanMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim()
    )
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
}

async function askAI(messages) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error(".env file mein GEMINI_API_KEY nahi hai");
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }]
    })),
    generationConfig: { maxOutputTokens: 1800 }
  });

  for (let attempt = 1; attempt <= 3; attempt++) {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY
      },
      body
    });

    if (r.ok) {
      const data = await r.json();
      const parts = (data.candidates && data.candidates[0] && data.candidates[0].content.parts) || [];
      const text = parts.map((p) => p.text || "").join("\n").trim();
      if (!text) throw new Error("Gemini ne khaali jawab diya");
      return text;
    }
    const errorText = await r.text();
    if (r.status === 503 || r.status === 429 || r.status === 500) {
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
        continue;
      }
    }
    throw new Error("Gemini error " + r.status + ": " + errorText);
  }
}

app.post("/api/chat", async (req, res) => {
  try {
    const messages = cleanMessages(req.body.messages);
    if (!messages.length || messages[messages.length - 1].role !== "user") {
      return res.status(400).json({ error: "Sawal khaali hai." });
    }
    const reply = await askAI(messages);
    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Kuch masla aa gaya, dobara koshish karein." });
  }
});

app.post("/api/crop-advice", async (req, res) => {
  try {
    const f = req.body || {};
    const field = (v) => String(v || "maloom nahi").slice(0, 200);
    const prompt = `Ek kisan ne ye maloomat di hain:
- Ilaqa/Zila: ${field(f.location)}
- Mausam: ${field(f.season)}
- Zameen: ${field(f.soil)}
- Paani: ${field(f.water)}
- Rakba: ${field(f.area)}
- Muddat: ${field(f.duration)}
- Bajat: ${field(f.budget)}
- Pichli fasal: ${field(f.lastCrop)}
- Masla: ${field(f.notes)}

In ke hisaab se 3 behtar faslein, unka jadwal (bijai, din, paani, lagat, paidawar, khatray) aur aakhir mein meri sifarish dein.`;

    const reply = await askAI([{ role: "user", content: prompt }]);
    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Kuch masla aa gaya, dobara koshish karein." });
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Kisan AI Saathi chal raha hai: http://localhost:${PORT}`);
  });
}

module.exports = app;
