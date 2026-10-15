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
      const raw = Buffer.concat(chunks).toString() || '{}';
      body = JSON.parse(raw);
    }

    const message = body.message;
    if (!message) return res.status(400).json({ error: 'Message missing' });

    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: message }] }] })
    });
    const data = await r.json();
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Jawab nahi mila';
    return res.json({ reply });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
