// Vercel Serverless Function. Requires KV_REST_API_URL + KV_REST_API_TOKEN.
const allowed = new Set(['typographie-manuscrite-v001']);
const cookie = (req, name) => (req.headers.cookie || '').split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1);
async function kv(command, ...args) {
  const response = await fetch(process.env.KV_REST_API_URL, { method:'POST', headers:{Authorization:`Bearer ${process.env.KV_REST_API_TOKEN}`,'Content-Type':'application/json'}, body:JSON.stringify([command,...args]) });
  if (!response.ok) throw new Error(`KV ${response.status}`); return response.json();
}
module.exports = async (req, res) => {
  res.setHeader('Content-Type','application/json');
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return res.status(503).json({message:'Vote server not configured: link Vercel KV.'});
  if (req.method !== 'POST') return res.status(405).json({message:'POST only'});
  const {evolution,value} = req.body || {};
  if (!allowed.has(evolution) || !['like','dislike'].includes(value)) return res.status(400).json({message:'Invalid vote.'});
  let visitor = cookie(req,'mutine_visitor');
  if (!visitor) { visitor = crypto.randomUUID(); res.setHeader('Set-Cookie',`mutine_visitor=${visitor}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000; Secure`); }
  const key=`mutine:vote:${evolution}:${visitor}`;
  const prior = await kv('GET',key); if (prior.result) return res.status(409).json({message:'Une voix a déjà été déposée pour cette évolution.'});
  await kv('SET',key,value,'EX',31536000); await kv('HINCRBY',`mutine:totals:${evolution}`,value,1);
  const totals=await kv('HGETALL',`mutine:totals:${evolution}`);
  return res.status(201).json({message:'Vote enregistré : pression, pas verdict.',totals:totals.result||{}});
};
