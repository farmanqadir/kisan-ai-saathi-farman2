// api/chat.js - CONFIRM WORKING - AUTO FALLBACK
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    let raw = (process.env.GEMINI_API_KEY || '').trim();
    let m = raw.match(/AIza[0-9A-Za-z\-_]{30,}/);
    let key = m? m[0] : raw.replace(/["'\s]/g, '');

    if (!key) return res.status(200).json({ reply: 'Key nahi mili' });
    if (req.method === 'GET') return res.status(200).json({ ok: true, len: key.length });

    let body = req.body;
    if (!body) {
      try {
        let t = await new Promise(r => { let d=''; req.on('data',c=>d+=c); req.on('end',()=>r(d)); });
        body = t? JSON.parse(t) : {};
      } catch { body = {}; }
    }
    if (typeof body === 'string') try{ body = JSON.parse(body); }catch{ body = {}; }

    let msg = body.message || body.prompt || '';
    if (Array.isArray(body.messages) && body.messages.length>0){
      let last = body.messages[body.messages.length-1];
      msg = last.content || last.text || last.message || '';
    }
    msg = (msg||'').toString().trim();
    if (!msg) return res.status(200).json({ reply: 'Message khali hai' });

    // YE LIST KHUD TRY KAREGI - koi bhi ek chal jayega
    let models = [
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-1.5-flash',
      'gemini-flash-latest',
      'gemini-1.5-flash-latest'
    ];

    let lastError = '';
    for (let model of models) {
      let url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
      let r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({ contents: [{ parts: [{ text: msg }] }] })
      });
      let data = await r.json();
      if (r.ok) {
        let reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Jawab nahi mila';
        return res.status(200).json({ reply });
      } else {
        lastError = data.error?.message || JSON.stringify(data);
        // Agar model not found to agla try karo, warna error dikhao
        if (lastError.toLowerCase().includes('not found') || lastError.toLowerCase().includes('no longer available')) {
          continue;
        } else {
          return res.status(200).json({ reply: 'Google Error: ' + lastError });
        }
      }
    }
    return res.status(200).json({ reply: 'Google Error: ' + lastError });

  } catch (e) {
    return res.status(200).json({ reply: 'Server Error: ' + e.message });
  }
}
