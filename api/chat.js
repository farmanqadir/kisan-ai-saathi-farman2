export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    var raw = process.env.GEMINI_API_KEY || '';
    var key = raw.trim().replace(/"/g, '').replace(/'/g, '');

    if (req.method === 'GET') {
      return res.status(200).json({ ok: true, keyLagi: key.length > 0, len: key.length });
    }

    var body = req.body || {};
    var msg = body.message || '';

    if (!msg) {
      return res.status(200).json({ reply: 'Message khali hai' });
    }
    if (!key) {
      return res.status(200).json({ reply: 'Vercel me key nahi hai' });
    }

    var url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + key;

    var r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: msg }] }] })
    });

    var data = await r.json();

    if (!r.ok) {
      return res.status(200).json({ reply: 'Google Error: ' + (data.error? data.error.message : 'key galat') });
    }

    var text = '';
    if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
      text = data.candidates[0].content.parts[0].text;
    }

    return res.status(200).json({ reply: text || 'Jawab khali' });

  } catch (err) {
    return res.status(200).json({ reply: 'Server Error: ' + err.message });
  }
}
