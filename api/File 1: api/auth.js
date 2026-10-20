const crypto = require("crypto");

const VERSION = "auth-v1";
const SESSION_DAYS = 30;          // sign in kitne din yaad rahe
const MIN_PASSWORD = 6;
const MAX_LOGIN_FAILS = 10;       // itni ghalat koshishon ke baad 15 min block
const FAIL_BLOCK_SECONDS = 15 * 60;

// ---------- Database (Upstash Redis REST - koi npm package nahi chahiye) ----------
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
  if (!REDIS_URL || !REDIS_TOKEN) {
    throw new Error("Database not connected: KV_REST_API_URL / KV_REST_API_TOKEN missing in Vercel.");
  }
  const r = await fetch(REDIS_URL, {
    method: "POST",
    headers: { Authorization: "Bearer " + REDIS_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });
  const data = await r.json();
  if (data && data.error) throw new Error("Database error: " + data.error);
  return data ? data.result : null;
}

// ---------- Password hashing ----------
function hashPassword(password, salt) {
  salt = salt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { salt: salt, hash: hash };
}
function verifyPassword(password, salt, hash) {
  try {
    const a = crypto.scryptSync(password, salt, 64);
    const b = Buffer.from(hash, "hex");
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch (e) {
    return false;
  }
}

// ---------- Helpers ----------
function normalizeId(v) {
  return String(v || "").trim().toLowerCase();
}
function isValidId(id) {
  return /^[a-z0-9@._+-]{3,60}$/.test(id);
}
function getToken(req, body) {
  const h = String(req.headers.authorization || "");
  if (h.startsWith("Bearer ")) return h.slice(7).trim();
  return body && typeof body.token === "string" ? body.token.trim() : "";
}
async function createSession(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  await redis("SET", "session:" + token, userId, "EX", SESSION_DAYS * 86400);
  return token;
}
function send(res, obj) {
  return res.status(200).json(obj);
}

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();

  // Browser mein URL kholne par: database connected hai ya nahi
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

    const action = String(body.action || "").toLowerCase();

    // ================= SIGNUP =================
    if (action === "signup") {
      const id = normalizeId(body.email || body.username);
      const name = String(body.name || "").trim().slice(0, 40);
      const password = String(body.password || "");

      if (!isValidId(id)) {
        return send(res, { ok: false, error: "Please enter a valid username or email (3-60 characters, letters/numbers/@ . _ - only)." });
      }
      if (password.length < MIN_PASSWORD) {
        return send(res, { ok: false, error: "Password must be at least " + MIN_PASSWORD + " characters." });
      }
      if (password.length > 72) return send(res, { ok: false, error: "Password too long." });

      const { salt, hash } = hashPassword(password);
      const user = { id: id, name: name || id, salt: salt, hash: hash, createdAt: Date.now() };

      // NX = sirf tab save karo jab ye user pehle se na ho
      const created = await redis("SET", "user:" + id, JSON.stringify(user), "NX");
      if (created !== "OK") {
        return send(res, { ok: false, error: "This username/email is already registered. Please sign in." });
      }

      const token = await createSession(id);
      return send(res, { ok: true, token: token, user: { id: id, name: user.name } });
    }

    // ================= LOGIN =================
    if (action === "login") {
      const id = normalizeId(body.email || body.username);
      const password = String(body.password || "");
      if (!id || !password) return send(res, { ok: false, error: "Please enter username/email and password." });

      const failKey = "fail:" + id;
      const fails = Number(await redis("GET", failKey)) || 0;
      if (fails >= MAX_LOGIN_FAILS) {
        return send(res, { ok: false, error: "Too many wrong attempts. Please try again after 15 minutes." });
      }

      const raw = await redis("GET", "user:" + id);
      const user = raw ? JSON.parse(raw) : null;

      if (!user || !verifyPassword(password, user.salt, user.hash)) {
        await redis("INCR", failKey);
        await redis("EXPIRE", failKey, FAIL_BLOCK_SECONDS);
        return send(res, { ok: false, error: "Wrong username/email or password." });
      }

      await redis("DEL", failKey);
      const token = await createSession(id);
      return send(res, { ok: true, token: token, user: { id: id, name: user.name || id } });
    }

    // ================= ME (page load par check) =================
    if (action === "me") {
      const token = getToken(req, body);
      if (!token) return send(res, { ok: false, error: "Not signed in." });
      const id = await redis("GET", "session:" + token);
      if (!id) return send(res, { ok: false, error: "Session expired. Please sign in again." });
      const raw = await redis("GET", "user:" + id);
      const user = raw ? JSON.parse(raw) : {};
      await redis("EXPIRE", "session:" + token, SESSION_DAYS * 86400);
      return send(res, { ok: true, user: { id: id, name: user.name || id } });
    }

    // ================= LOGOUT =================
    if (action === "logout") {
      const token = getToken(req, body);
      if (token) await redis("DEL", "session:" + token);
      return send(res, { ok: true });
    }

    return send(res, { ok: false, error: "Unknown action." });
  } catch (err) {
    return send(res, { ok: false, error: err.message });
  }
};
