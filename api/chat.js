export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // 1. Key handling - aap 2-3 keys bhi laga sakte ho comma se
    let allKeys = (process.env.GEMINI_API_KEY || '').split(',').map(k => k.trim()).filter(Boolean);
    if (allKeys.length === 0) return res.json({ reply: 'API Key missing hai Vercel me.' });

    // 2. Message nikalna
    let b = req.body;
    if (!b) {
      let t = await new Promise(r => { let d = ''; req.on('data', c => d += c); req.on('end', () => r(d)); });
      try { b = t? JSON.parse(t) : {}; } catch { b = {}; }
    }
    let msg = b.message || b.prompt || '';
    if (Array.isArray(b.messages)) msg = b.messages.slice(-1)[0]?.content || '';
    if (!msg.trim()) return res.json({ reply: 'Assalam o Alaikum! Sawal likhein.' });

    // 3. Naye wale models - ye kabhi band nahi honge
    let models = [
      'gemini-3-flash-preview',
      'gemini-2.5-flash',
      'gemini-1.5-flash',
      'gemini-flash-latest'
    ];

    // 4. Har key aur har model try karo
    for (let key of allKeys) {
      for (let model of models) {
        try {
          let url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
          let r = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
            body: JSON.stringify({
              contents: [{ parts: [{ text: `Tum Kisan AI Saathi ho. Kisan ko Urdu/Hindi mix me simple jawab do. Sawal: ${msg}` }] }]
            })
          });
          let data = await r.json();
          if (r.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
            return res.json({ reply: data.candidates[0].content.parts[0].text });
          }
          // Agar quota khatam to agla model/key try karo
          if (data.error && (data.error.code === 429 || data.error.status === 'RESOURCE_EXHAUSTED')) {
            continue;
          }
        } catch (e) { continue; }
      }
    }

    return res.json({ reply: 'Abhi server thora busy hai, 2 minute baad dobara try karen.' });

  } catch (e) {
    return res.json({ reply: 'Error: ' + e.message });
  }
}
