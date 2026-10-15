export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    var raw = process.env.GEMINI_API_KEY || '';
    // Zabardasti AIza... wala hissa nikaalo, chahe " " ho ya poori line ho
    var m = raw.match(/AIza[0-9A-Za-z\-_]{30,}/);
    var key = m? m[0] : raw.trim().replace(/["' \n\r]/g, '');

    if (req.method === 'GET') {
      return res.status(200).json({ ok:true, len: key.length, first5: key.slice(0,5) });
    }

    var body = req.body;
    if (!body) {
      try {
        var t = await new Promise(r=>{ var d=''; req.on('data',c=>d+=c); req.on('end',()=>r(d)); });
        body = t? JSON.parse(t) : {};
      } catch { body={}; }
    }
    if (typeof body === 'string') try{ body=JSON.parse(body);}catch{ body={}; }

    var msg = (body.message || body.prompt || '').trim();
    if (!msg) return res.status(200).json({ reply: 'Message khali hai' });

    var url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + key;
    var r = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ contents:[{parts:[{text:msg}]}] }) });
    var data = await r.json();
    if (!r.ok) return res.status(200).json({ reply: 'Google Error: ' + (data.error?.message || 'key galat') });
    return res.status(200).json({ reply: data.candidates?.[0]?.content?.parts?.[0]?.text || 'Jawab nahi' });
  } catch(e) {
    return res.status(200).json({ reply: 'Server Error: '+ e.message });
  }
}
