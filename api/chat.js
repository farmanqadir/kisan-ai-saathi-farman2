// api/chat.js - FINAL WORKING CODE
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // 1. API Key saaf karna
    let raw = (process.env.GEMINI_API_KEY || '').trim();
    let m = raw.match(/AIza[0-9A-Za-z\-_]{30,}/);
    let key = m? m[0] : raw.replace(/["'\s]/g, '');

    if (!key) {
      return res.status(200).json({ reply: 'Server Error: GEMINI_API_KEY Vercel me nahi lagi hui' });
    }

    // GET se check karne ke liye
    if (req.method === 'GET') {
      return res.status(200).json({ ok: true, len: key.length });
    }

    // 2. Body parhna - aapka frontend {messages:[...]} bhejta hai
    let body = req.body;
    if (!body) {
      try {
        let t = await new Promise(r => {
          let d = '';
          req.on('data', c => d += c);
          req.on('end', () => r(d));
        });
        body = t? JSON.parse(t) : {};
      } catch { body = {}; }
    }
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = {}; }
    }

    let msg = '';
    if (body.message) msg = body.message;
    else if (body.prompt) msg = body.prompt;
    else if (Array.isArray(body.messages) && body.messages.length > 0) {
      // Aakhri user ka sawal
      let last = body.messages[body.messages.length - 1];
      msg = last.content || last.text || last.message || '';
    }

    msg = (msg || '').toString().trim();
    if (!msg) {
      return res.status(200).json({ reply: 'Message khali hai' });
    }

    // 3. Gemini ko call - naya model 2.0-flash
    let url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

    let r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': key
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: msg }] }]
      })
    });

    let data = await r.json();

    if (!r.ok) {
      return res.status(200).json({
        reply: 'Google Error: ' + (data.error?.message || JSON.stringify(data))
      });
    }

    let reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Jawab nahi mila';
    return res.status(200).json({ reply });

  } catch (e) {
    return res.status(200).json({ reply: 'Server Error: ' + e.message });
  }
}
