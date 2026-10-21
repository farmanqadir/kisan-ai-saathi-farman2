const VERSION = "history-v2-10k-chars";
const MAX_CHATS = 300;              // Per user max chats (purani auto-delete)
const MAX_MESSAGES_PER_CHAT = 100;  // Ek chat mein last 100 messages
const MAX_CONTENT_CHARS = 10000;    // Updated: 10,000 characters tak ke lambe messages support
const MAX_TITLE_CHARS = 80;
const MAX_IMPORT = 100;             // First login par local history import limit

// ---------- Database Connection (Upstash Redis REST) ----------
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

function checkDb() {
  if (!REDIS_URL || !REDIS_TOKEN) {
    throw new Error("Database not connected: KV_REST_API_URL / KV_REST_API_TOKEN missing in Vercel.");
  }
}

async function redis(...command) {
  checkDb();
  const r = await fetch(REDIS_URL, {
    method: "POST",
    headers: { Authorization: "Bearer " + REDIS_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });
  const data = await r.json();
  if (data && data.error) throw new Error("Database error: " + data.error);
  return data ? data.result : null;
}

async function redisPipeline(commands) {
  checkDb();
  const r = await fetch(REDIS_URL + "/pipeline", {
    method: "POST",
    headers: { Authorization: "Bearer " + REDIS_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
  });
  const data = await r.json();
  if (!Array.isArray(data)) throw new Error("Database error: " + JSON.stringify(data).slice(0, 200));
  const bad = data.find((x) => x && x.error);
  if (bad) throw new Error("Database error: " + bad.error);
  return data.map((x) => x.result);
}

// ---------- Helper Functions ----------
function send(res, obj) {
  return res.status(200).json(obj);
}

function getToken(req, body) {
  const h = String(req.headers.authorization || "");
  if (h.startsWith("Bearer ")) return h.slice(7).trim();
  return body && typeof body.token === "string" ? body.token.trim() : "";
}

async function getUserId(req, body) {
  const token = getToken(req, body);
  if (!token) return null;
  const id = await redis("GET", "session:" + token);
  return id || null;
}

function zkey(u) { return "chats:" + u; }
function ckey(u, id) { return "chat:" + u + ":" + id; }
function isValidChatId(id) { return /^[A-Za-z0-9_.-]{1,64}$/.test(id); }

function sanitizeChat(raw, keepClientTime) {
  if (!raw || typeof raw !== "object") return null;
  const id = String(raw.id || "").trim();
  if (!isValidChatId(id)) return null;

  const msgs = [];
  if (Array.isArray(raw.messages)) {
    for (const m of raw.messages) {
      if (!m || typeof m !== "object") continue;
      const role =
        m.role === "user" ? "user" :
        (m.role === "assistant" || m.role === "model" || m.role === "ai") ? "assistant" : null;
      const content = typeof m.content === "string" ? m.content.slice(0, MAX_CONTENT_CHARS) : "";
      if (!role || !content.trim()) continue;
      msgs.push({ role: role, content: content });
    }
  }
  if (!msgs.length) return null;

  const messages = msgs.slice(-MAX_MESSAGES_PER_CHAT);
  let title = typeof raw.title === "string" ? raw.title.trim().slice(0, MAX_TITLE_CHARS) : "";
  if (!title) {
    const firstUser = messages.find((m) => m.role === "user");
    title = (firstUser ? firstUser.content : "New Chat").slice(0, 40);
  }

  const now = Date.now();
  let updatedAt = Number(raw.updatedAt);
  if (!keepClientTime || !Number.isFinite(updatedAt) || updatedAt <= 0 || updatedAt > now + 60000) updatedAt = now;
  let createdAt = Number(raw.createdAt);
  if (!Number.isFinite(createdAt) || createdAt <= 0) createdAt = updatedAt;

  return { id: id, title: title, messages: messages, createdAt: createdAt, updatedAt: updatedAt };
}

// ---------- Main API Handler ----------
module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "GET") {
    let db = "connected";
    try { await redis("PING"); } catch (e) { db = e.message; }
    return send(res, { version: VERSION, db: db, envFound: { url: !!REDIS_URL, token: !!REDIS_TOKEN } });
  }

  if (req.method !== "POST") return send(res, { ok: false, error: "Invalid request method." });

  try {
    let body;
    try {
      body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    } catch (e) {
      return send(res, { ok: false, error: "Invalid JSON body." });
    }

    const action = String(body.action || "list").toLowerCase();

    const user = await getUserId(req, body);
    if (!user) return send(res, { ok: false, authError: true, error: "Not signed in. Please sign in again." });

    // ===== LIST: User ki saari purani history (Latest pehle) =====
    if (action === "list") {
      const ids = await redis("ZREVRANGE", zkey(user), 0, MAX_CHATS - 1);
      if (!ids || !ids.length) return send(res, { ok: true, chats: [] });
      const values = await redis("MGET", ...ids.map((id) => ckey(user, id)));
      const chats = [];
      (values || []).forEach((v) => {
        if (v) { try { chats.push(JSON.parse(v)); } catch (e) {} }
      });
      return send(res, { ok: true, chats: chats });
    }

    // ===== GET: Ek specific chat fetch karo =====
    if (action === "get") {
      const id = String(body.id || "").trim();
      if (!isValidChatId(id)) return send(res, { ok: false, error: "Invalid chat id." });
      const v = await redis("GET", ckey(user, id));
      return send(res, { ok: true, chat: v ? JSON.parse(v) : null });
    }

    // ===== SAVE: Ek chat database mein save/update karo =====
    if (action === "save") {
      const chat = sanitizeChat(body.chat, false);
      if (!chat) return send(res, { ok: false, error: "Invalid or empty chat." });

      await redisPipeline([
        ["SET", ckey(user, chat.id), JSON.stringify(chat)],
        ["ZADD", zkey(user), chat.updatedAt, chat.id],
      ]);

      const count = Number(await redis("ZCARD", zkey(user))) || 0;
      if (count > MAX_CHATS) {
        const old = await redis("ZRANGE", zkey(user), 0, count - MAX_CHATS - 1);
        if (old && old.length) {
          await redisPipeline([
            ["DEL", ...old.map((id) => ckey(user, id))],
            ["ZREM", zkey(user), ...old],
          ]);
        }
      }
      return send(res, { ok: true, id: chat.id, updatedAt: chat.updatedAt });
    }

    // ===== IMPORT: Local chats to Cloud Database =====
    if (action === "import") {
      const list = Array.isArray(body.chats) ? body.chats.slice(0, MAX_IMPORT) : [];
      const cmds = [];
      let count = 0;
      for (const raw of list) {
        const chat = sanitizeChat(raw, true);
        if (!chat) continue;
        cmds.push(["SET", ckey(user, chat.id), JSON.stringify(chat), "NX"]);
        cmds.push(["ZADD", zkey(user), "NX", chat.updatedAt, chat.id]);
        count++;
      }
      for (let i = 0; i < cmds.length; i += 20) {
        await redisPipeline(cmds.slice(i, i + 20));
      }
      return send(res, { ok: true, imported: count });
    }

    // ===== DELETE: Ek single chat delete karo =====
    if (action === "delete") {
      const id = String(body.id || "").trim();
      if (!isValidChatId(id)) return send(res, { ok: false, error: "Invalid chat id." });
      await redisPipeline([["DEL", ckey(user, id)], ["ZREM", zkey(user), id]]);
      return send(res, { ok: true });
    }

    // ===== CLEAR: Account ki poori history clear karo =====
    if (action === "clear") {
      const ids = await redis("ZRANGE", zkey(user), 0, -1);
      const cmds = [["DEL", zkey(user)]];
      if (ids && ids.length) cmds.push(["DEL", ...ids.map((id) => ckey(user, id))]);
      await redisPipeline(cmds);
      return send(res, { ok: true, deleted: ids ? ids.length : 0 });
    }

    return send(res, { ok: false, error: "Unknown action." });
  } catch (err) {
    return send(res, { ok: false, error: err.message });
  }
};
