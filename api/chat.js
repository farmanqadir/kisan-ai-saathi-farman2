export default async function handler(req,res){
res.setHeader('Access-Control-Allow-Origin','*');
res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
res.setHeader('Access-Control-Allow-Headers','Content-Type');
if(req.method==='OPTIONS')return res.status(200).end();
try{
let raw=(process.env.GEMINI_API_KEY||'').trim();
let m=raw.match(/AIza[0-9A-Za-z\-_]{30,}/);
let key=m?m[0]:raw.replace(/["'\s]/g,'');
if(!key)return res.json({reply:'Key missing'});
if(req.method==='GET')return res.json({len:key.length});
let b=req.body;
if(!b){try{let t=await new Promise(r=>{let d='';req.on('data',c=>d+=c);req.on('end',()=>r(d));});b=t?JSON.parse(t):{};}catch{b={};}
}
if(typeof b==='string')try{b=JSON.parse(b);}catch{}
let msg=b.message||b.prompt||'';
if(Array.isArray(b.messages)&&b.messages.length>0){let l=b.messages[b.messages.length-1];msg=l.content||l.text||'';}
msg=(msg||'').trim();
if(!msg)return res.json({reply:'Khali'});
let models=['gemini-2.5-flash','gemini-2.5-flash-lite','gemini-flash-latest'];
for(let model of models){
let url=`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
let r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify({contents:[{parts:[{text:msg}]}]})});
let data=await r.json();
if(r.ok){return res.json({reply:data.candidates?.[0]?.content?.parts?.[0]?.text||'No reply'});}
if(!JSON.stringify(data).includes('not found') &&!JSON.stringify(data).includes('no longer')){return res.json({reply:'Google Error: '+(data.error?.message||JSON.stringify(data))});}
}
return res.json({reply:'Sab models fail'});
}catch(e){return res.json({reply:'Server Error: '+e.message});}
}
