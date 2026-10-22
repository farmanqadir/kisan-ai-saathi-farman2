const crypto = require("crypto");

const VERSION = "auth-v2-features";
const SESSION_DAYS = 30;

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
    throw new Error("Database not connected in Vercel.");
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

function normalizeId(v) { return String(v || "").trim().toLowerCase(); }
function isValidId(id) { return /^[a-z0-9@._+-]{3,60}$/.test(id); }

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

function send(res, obj) { return res.status(200).json(obj); }

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "GET") {
    let db = "connected";
    try { await redis("PING"); } catch (e) { db = e.message; }
    return send(res, { version: VERSION, db: db });
  }

  if (req.method !== "POST") return send(res, { ok: false, error: "Invalid request method." });

  try {
    let body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const action = String(body.action || "").toLowerCase();

    // Signup
    if (action === "signup") {
      const id = normalizeId(body.email || body.username);
      const name = String(body.name || "").trim().slice(0, 40);
      const password = String(body.password || "");

      if (!isValidId(id)) return send(res, { ok: false, error: "Invalid username/email." });
      if (password.length < 6) return send(res, { ok: false, error: "Password must be at least 6 chars." });

      const { salt, hash } = hashPassword(password);
      const user = { id: id, name: name || id, avatar: body.avatar || "", salt: salt, hash: hash, createdAt: Date.now() };

      const created = await redis("SET", "user:" + id, JSON.stringify(user), "NX");
      if (created !== "OK") return send(res, { ok: false, error: "Username/Email already registered." });

      const token = await createSession(id);
      return send(res, { ok: true, token: token, user: { id: id, name: user.name, avatar: user.avatar } });
    }

    // Login
    if (action === "login") {
      const id = normalizeId(body.email || body.username);
      const password = String(body.password || "");

      const raw = await redis("GET", "user:" + id);
      const user = raw ? JSON.parse(raw) : null;

      if (!user || !verifyPassword(password, user.salt, user.hash)) {
        return send(res, { ok: false, error: "Wrong username/email or password." });
      }

      const token = await createSession(id);
      return send(res, { ok: true, token: token, user: { id: id, name: user.name || id, avatar: user.avatar || "" } });
    }

    // Session Me
    if (action === "me") {
      const token = getToken(req, body);
      if (!token) return send(res, { ok: false, error: "Not signed in." });
      const id = await redis("GET", "session:" + token);
      if (!id) return send(res, { ok: false, error: "Session expired." });
      const raw = await redis("GET", "user:" + id);
      const user = raw ? JSON.parse(raw) : {};
      return send(res, { ok: true, user: { id: id, name: user.name || id, avatar: user.avatar || "" } });
    }

    // Update Profile (Name, Avatar, Change Password)
    if (action === "update-profile") {
      const token = getToken(req, body);
      const id = await redis("GET", "session:" + token);
      if (!id) return send(res, { ok: false, error: "Unauthorized." });

      const raw = await redis("GET", "user:" + id);
      if (!raw) return send(res, { ok: false, error: "User not found." });
      let user = JSON.parse(raw);

      if (body.name) user.name = String(body.name).trim().slice(0, 40);
      if (body.avatar) user.avatar = String(body.avatar);
      if (body.newPassword) {
        if (body.newPassword.length < 6) return send(res, { ok: false, error: "New password too short." });
        const { salt, hash } = hashPassword(body.newPassword);
        user.salt = salt;
        user.hash = hash;
      }

      await redis("SET", "user:" + id, JSON.stringify(user));
      return send(res, { ok: true, user: { id: id, name: user.name, avatar: user.avatar } });
    }

    // Forgot Password Reset
    if (action === "forgot-password") {
      const id = normalizeId(body.email || body.username);
      const newPassword = String(body.newPassword || "");
      if (!id || newPassword.length < 6) return send(res, { ok: false, error: "Valid username and 6+ char password required." });

      const raw = await redis("GET", "user:" + id);
      if (!raw) return send(res, { ok: false, error: "Account not found." });

      let user = JSON.parse(raw);
      const { salt, hash } = hashPassword(newPassword);
      user.salt = salt;
      user.hash = hash;

      await redis("SET", "user:" + id, JSON.stringify(user));
      return send(res, { ok: true, message: "Password updated successfully! Please sign in." });
    }

    // Logout
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
