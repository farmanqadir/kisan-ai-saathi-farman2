export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    var raw = process.env.GEMINI_API_KEY || '';
    var key = raw.trim().replace(/"/g, '').replace(/'/g, '').trim();

    if (req.method === 'GET') {
      return res.status(200).json({ ok: true, len: key.length });
    }

    // Body ko har tarah se parhne ki koshish
    var body = req.body;
    if (!body) {
      try {
        var text = await new Promise((resolve) => {
          var d = '';
          req.on('data', c => d += c);
          req.on('end', () => resolve(d));
        });
        body = text? JSON.parse(text) : {};
      } catch { body = {}; }
    }
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = {}; }
    }

    var msg = body.message || body.prompt || body.question || '';
    if (typeof msg === 'string') msg = msg.trim();

    if (!msg) {
      return res.status(200).json({ reply: 'Bhai message type to karo, khali bhej diya' });
    }
    if (!key || key.length < 30) {
      return res.status(200).json({ reply: 'Vercel me key 53 ki hai, 39 ki honi chahiye. Key me " lage huye hain' });
    }

    var url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + key;
    var r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: msg }] }] })
    });
    var data = await r.json();
    if (!r.ok) {
      return res.status(200).json({ reply: 'Google Error: ' + (data.error?.message || JSON.stringify(data).slice(0,200)) });
    }
    var txt = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Jawab nahi mila';
    return res.status(200).json({ reply: txt });

  } catch (e) {
    return res.status(200).json({ reply: 'Server Error: ' + e.message });
  }
}
