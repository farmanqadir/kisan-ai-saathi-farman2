module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    let body = req.body;
    if (!body || Object.keys(body).length === 0) {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const raw = Buffer.concat(chunks).toString();
      if (raw) body = JSON.parse(raw);
    }

    // Aap ke index.html se messages array aata hai
    let userText = body.message || body.prompt;
    if (!userText && Array.isArray(body.messages)) {
      const last = [...body.messages].reverse().find(m => m.role === 'user');
      userText = last?.content || body.messages[body.messages.length-1]?.content;
    }
    if (!userText) return res.status(400).json({ error: 'Message missing' });

    // Poori history ko prompt banao taake AI ko yaad rahe
    let fullPrompt = '';
    if (Array.isArray(body.messages)) {
      fullPrompt = body.messages.map(m => `${m.role === 'user'? 'Kisan' : 'Saathi'}: ${m.content}`).join('\n') + '\nSaathi:';
    } else {
      fullPrompt = userText;
    }

    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: fullPrompt }] }] })
    });
    const data = await r.json();
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Maazrat, jawab nahi mila';
    return res.json({ reply });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
