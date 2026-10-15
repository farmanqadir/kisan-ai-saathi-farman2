export default async function handler(req,res){
res.setHeader('Access-Control-Allow-Origin','*');
res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
res.setHeader('Access-Control-Allow-Headers','Content-Type');
if(req.method==='OPTIONS')return res.status(200).end();
try{
let keys=(process.env.GEMINI_API_KEY||'').split(',').map(k=>k.trim()).filter(Boolean);
let key=keys[0]||'';
if(!key)return res.json({reply:'Key missing'});
let b=req.body;
if(!b){let t=await new Promise(r=>{let d='';req.on('data',c=>d+=c);req.on('end',()=>r(d));});b=t?JSON.parse(t):{};}
if(typeof b==='string')try{b=JSON.parse(b);}catch{}
let msg=b.message||b.prompt||''; if(Array.isArray(b.messages))msg=b.messages.slice(-1)[0]?.content||'';
msg=(msg||'').trim(); if(!msg)return res.json({reply:'Sawal likhein'});

let models=['gemini-2.0-flash','gemini-2.0-flash-lite','gemini-flash-latest'];
for(let model of models){
 let url=`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
 let r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify({contents:[{parts:[{text:'Tum Kisan AI Saathi ho, kisan ko Urdu me jawab do. Sawal: '+msg}]}]})});
 let data=await r.json();
 if(r.ok && data.candidates?.[0]?.content?.parts?.[0]?.text){
   return res.json({reply:data.candidates[0].content.parts[0].text});
 }
}
return res.json({reply:'System thora busy hai, 1 minute baad try karen.'});
}catch(e){return res.json({reply:'Thori der baad try karen.'});}
}
