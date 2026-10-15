export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method!== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message } = req.body || {};
  if (!message) return res.status(400).json({ reply: 'Message missing' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ reply: 'GEMINI_API_KEY Vercel me nahi lagi' });

  try {
    // 2026 me ye model 100% chalta hai
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: message }] }] })
    });

    const data = await r.json();

    if (!r.ok) {
      return res.status(500).json({ reply: `Google Error: ${data.error?.message || JSON.stringify(data)}` });
    }

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!reply) return res.status(500).json({ reply: `Khali jawab: ${JSON.stringify(data)}` });

    return res.status(200).json({ reply });

  } catch (e) {
    return res.status(500).json({ reply: `Server Error: ${e.message}` });
  }
}
