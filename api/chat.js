export default async function handler(req,res){
res.setHeader('Access-Control-Allow-Origin','*');
res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
res.setHeader('Access-Control-Allow-Headers','Content-Type');
if(req.method==='OPTIONS')return res.status(200).end();
try{
let key=(process.env.GEMINI_API_KEY||'').trim().split(',')[0];
let b=req.body; if(!b){let t=await new Promise(r=>{let d='';req.on('data',c=>d+=c);req.on('end',()=>r(d));});b=t?JSON.parse(t):{};}
let msg=b.message||''; if(Array.isArray(b.messages))msg=b.messages.slice(-1)[0]?.content||'';
let url=`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`;
let r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify({contents:[{parts:[{text:msg}]}]})});
let data=await r.json();
if(data.error){ return res.json({reply:`GOOGLE ERROR: ${data.error.message} (Code: ${data.error.code})`}); }
return res.json({reply:data.candidates?.[0]?.content?.parts?.[0]?.text||'No reply'});
}catch(e){return res.json({reply:'Error: '+e.message});}
}
