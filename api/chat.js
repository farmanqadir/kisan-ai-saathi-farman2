export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS') return res.status(200).end();
  try{
    let raw=(process.env.GEMINI_API_KEY||'').trim();
    let m=raw.match(/AIza[0-9A-Za-z\-_]{30,}/);
    let key=m?m[0]:raw.replace(/["'\s]/g,'');
    if(req.method==='GET') return res.status(200).json({ok:true,len:key.length, prod:!!process.env.VERCEL_ENV});

    let body=req.body;
    if(!body){ try{ let t=await new Promise(r=>{let d='';req.on('data',c=>d+=c);req.on('end',()=>r(d))}); body=t?JSON.parse(t):{} }catch{body={}} }
    if(typeof body==='string') try{body=JSON.parse(body)}catch{body={}}

    let msg=body.message||body.prompt||'';
    if(Array.isArray(body.messages)){ let last=body.messages[body.messages.length-1]; msg=last.content||last.text||'' }
    msg=(msg||'').toString().trim();
    if(!msg) return res.status(200).json({reply:'Message khali hai'});

    // FIX: x-goog-api-key header se
    let url='https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
    let r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify({contents:[{parts:[{text:msg}]}]})});
    let data=await r.json();
    if(!r.ok) return res.status(200).json({reply:'Google Error: '+(data.error?.message||JSON.stringify(data))});
    return res.status(200).json({reply:data.candidates?.[0]?.content?.parts?.[0]?.text||'Jawab nahi mila'});
  }catch(e){ return res.status(200).json({reply:'Server Error: '+e.message}) }
}
