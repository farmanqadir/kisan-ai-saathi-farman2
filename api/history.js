const VERSION = "history-v5-production";
const MAX_CHATS = 300;
const MAX_CONTENT_CHARS = 10000;

function findEnv(names) {
  for (const n of names) if (process.env[n]) return process.env[n];
  const keys = Object.keys(process.env);
  for (const n of names) {
    const k = keys.find((key) => key.endsWith(n));
    if (k) return process.env[k];
  }
  return "";
}

const REDIS_URL = findEnv(["KV_REST_API_URL", "UPSTASH_REDIS_REST_URL"]).replace(/\/+$/, "");
const REDIS_TOKEN = findEnv(["KV_REST_API_TOKEN", "UPSTASH_REDIS_REST_TOKEN"]);

async function redis(...command) {
  const r = await fetch(REDIS_URL, {
    method: "POST",
    headers: { Authorization: "Bearer " + REDIS_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });
  const data = await r.json();
  return data ? data.result : null;
}

function send(res, obj) { return res.status(200).json(obj); }

function getToken(req, body) {
  const h = String(req.headers.authorization || "");
  if (h.startsWith("Bearer ")) return h.slice(7).trim();
  return body && typeof body.token === "string" ? body.token.trim() : "";
}

async function getUserId(req, body) {
  const token = getToken(req, body);
  if (!token) return null;
  return await redis("GET", "session:" + token);
}

function zkey(u) { return "chats:" + u; }
function ckey(u, id) { return "chat:" + u + ":" + id; }

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    let body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const action = String(body.action || "list").toLowerCase();

    const user = await getUserId(req, body);
    if (!user) return send(res, { ok: false, authError: true, error: "Not signed in." });

    // LIST CHATS WITH SEARCH FILTER
    if (action === "list") {
      const ids = await redis("ZREVRANGE", zkey(user), 0, MAX_CHATS - 1);
      if (!ids || !ids.length) return send(res, { ok: true, chats: [] });
      const values = await redis("MGET", ...ids.map((id) => ckey(user, id)));
      let chats = [];
      (values || []).forEach((v) => { if (v) try { chats.push(JSON.parse(v)); } catch (e) {} });

      const search = String(body.search || "").toLowerCase().trim();
      if (search) {
        chats = chats.filter(c => (c.title || "").toLowerCase().includes(search) || JSON.stringify(c.messages || "").toLowerCase().includes(search));
      }

      chats.sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0) || b.updatedAt - a.updatedAt);
      return send(res, { ok: true, chats: chats });
    }

    // SAVE CHAT
    if (action === "save") {
      const chat = body.chat;
      if (!chat || !chat.id) return send(res, { ok: false, error: "Invalid chat." });
      chat.updatedAt = Date.now();

      await redis("SET", ckey(user, chat.id), JSON.stringify(chat));
      await redis("ZADD", zkey(user), chat.updatedAt, chat.id);
      return send(res, { ok: true });
    }

    // PERMANENT DELETE (DEFECT 15 FIX)
    if (action === "delete") {
      const id = String(body.id || "").trim();
      await redis("DEL", ckey(user, id));
      await redis("ZREM", zkey(user), id);
      return send(res, { ok: true, deletedId: id });
    }

    return send(res, { ok: false, error: "Unknown action." });
  } catch (err) {
    return send(res, { ok: false, error: err.message });
  }
};
