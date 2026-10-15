export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const apiKey = process.env.GEMINI_API_KEY;

  // 1. DEBUG KE LIYE: Browser me /api/chat kholne par pata chalega key lagi ya nahi
  if (req.method === 'GET') {
    return res.status(200).json({
      keyLagiHai:!!apiKey,
      keyLength: apiKey? apiKey.length : 0,
      message: apiKey? "Key Vercel me lag gayi hai" : "Key Vercel me NAHI lagi - Environment Variables check karo"
    });
  }

  if (req.method!== 'POST') return res.status(405).json({ reply: 'Method not allowed' });

  const { message } = req.body || {};
  if (!message) return res.status(400).json({ reply: 'Message missing' });
  if (!apiKey) return res.status(500).json({ reply: 'Vercel me GEMINI_API_KEY nahi mili' });

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: message }] }] })
    });
    const data = await r.json();
    if (!r.ok) return res.status(500).json({ reply: data.error?.message || JSON.stringify(data) });
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return res.status(200).json({ reply: reply || "Google ne khali jawab diya" });
  } catch (e) {
    return res.status(500).json({ reply: e.message });
  }
}
