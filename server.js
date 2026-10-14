require("dotenv").config();
const express = require("express");
const path = require("path");

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const SYSTEM_PROMPT = `Aap "Kisan AI Saathi" hain, Pakistan ke kisanon ke liye ek zaheen aur hamdard zarai (agriculture) mushir.

ZABAN:
- Jawab hamesha usi zaban mein dein jis mein kisan sawal kare: Roman Urdu, Urdu ya English.
- Aasan lafz istemal karein. Kisan kam parha likha ho sakta hai, is liye mushkil science ke alfaaz se bachein.

AAP KIN MASAIL MEIN MADAD KARTE HAIN:
- Mausam aur season ke hisaab se fasal ka intikhab (Rabi / Kharif / Zaid)
- Kam muddat mein tayyar hone wali fasalein aur un ka muqabla
- Beej ki qism, bijai ka waqt, fasle ka faasla
- Zameen ki qism (chikni, retli, maira) aur khaad ka mansooba
- Paani/aabpashi ka schedule aur paani bachane ke tareeqay
- Fasal ki bimariyan, keeray, jharian aur un ka ilaaj
- Lagat, mumkina paidawar aur munafe ka andaza
- Mandi, store karna aur bechne ke mashware

JAWAB KA ANDAAZ:
1. Pehle seedha mukhtasar jawab dein, phir tafseel.
2. Jab fasal ka mashwara dein to har fasal ke liye ye batayein: bijai ka waqt, tayyar hone ka muddat (din), paani ki zaroorat, andaza lagat, andaza paidawar per acre, aur khatray.
3. Agar zaroori maloomat kam hon (ilaqa, zameen, paani, mausam, rakba) to pehle 2-3 chhote sawal poochein.
4. Andazay hamesha "taqreeban" keh kar dein. Qeematein aur paidawar jagah aur saal ke hisaab se badalti hain, is liye jhooti yaqeen dihani na karein.

HIFAZAT AUR DIYANATDARI:
- Keeray maar ya jharri maar dawa ka naam batayen to dose ke liye label parhne aur apne ilaqay ke zarai mahir (agriculture extension officer) se confirm karne ko kahein. Hifazati libas (dastane, mask) ka zikr karein.
- Agar aap ko pakka yaqeen na ho to saaf kahein. Bari bimari ya nuksan ki soorat mein qareebi zarai daftar ya mahir se milne ko kahein.
- Ghalat ya khatarnak mashwara kabhi na dein.`;

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
    systemInstruction: {
      parts: [{ text: SYSTEM_PROMPT }]
    },
    contents: messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }]
    })),
    generationConfig: {
      maxOutputTokens: 1800
    }
  });

  // 503 aaye to automatically 3 dafa retry karega
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

      const parts =
        (data.candidates &&
          data.candidates[0] &&
          data.candidates[0].content &&
          data.candidates[0].content.parts) || [];

      const text = parts.map((p) => p.text || "").join("\n").trim();

      if (!text) {
        throw new Error("Gemini ne khaali jawab diya");
      }

      return text;
    }

    const errorText = await r.text();

    // Sirf temporary errors par retry
    if (r.status === 503 || r.status === 429 || r.status === 500) {
      if (attempt < 3) {
        await new Promise((resolve) =>
          setTimeout(resolve, attempt * 2000)
        );
        continue;
      }
    }

    throw new Error(
      "Gemini error " + r.status + ": " + errorText
    );
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
- Maujooda mahina/season: ${field(f.season)}
- Zameen ki qism: ${field(f.soil)}
- Paani ka zariya: ${field(f.water)}
- Zameen ka rakba: ${field(f.area)}
- Kitne muddat mein fasal chahiye: ${field(f.duration)}
- Bajat/lagat ki hadd: ${field(f.budget)}
- Pichli fasal: ${field(f.lastCrop)}
- Khaas sawal ya masla: ${field(f.notes)}

In maloomat ke hisaab se:
1. Is waqt kaun si 3 fasalein sab se behtar rahengi, un ki wajah ke saath.
2. Har fasal ke liye ek jadwal (table) banayein: bijai ka waqt, tayyar hone ke din, paani ki zaroorat, taqreeban lagat, taqreeban paidawar per acre, khatray.
3. Agar kisan ne kam muddat maangi hai to sab se jaldi tayyar hone wali fasal pehle rakhein.
4. Aakhir mein ek saaf "meri sifarish" dein aur 2-3 zaroori ehtiyaati baatein likhein.`;

    const reply = await askAI([{ role: "user", content: prompt }]);
    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Kuch masla aa gaya, dobara koshish karein." });
  }
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Kisan AI Saathi chal raha hai: http://localhost:${PORT}`);
  });
}
app.get("/", (req, res) => {
  res.json({ message: "Kisan AI Saathi API is Running!" });
});

module.exports = app;
