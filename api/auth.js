const crypto = require("crypto");

const VERSION = "auth-v3-phone-support";
const SESSION_DAYS = 90; // Reload par bar bar login na karna pade (90 days persistent token)

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
  if (!REDIS_URL || !REDIS_TOKEN) throw new Error("Database not connected in Vercel.");
  const r = await fetch(REDIS_URL, {
    method: "POST",
    headers: { Authorization: "Bearer " + REDIS_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });
  const data = await r.json();
  return data ? data.result : null;
}

function hashPassword(password, salt) {
  salt = salt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
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

// Phone Number or Email Normalizer (e.g., 03001234567 or +923001234567 or user@mail.com)
function normalizeId(v) {
  let str = String(v || "").trim().toLowerCase();
  // Format Pakistani phone numbers: 03001234567 -> 923001234567
  if (/^03\d{9}$/.test(str)) str = "92" + str.slice(1);
  if (/^\+923\d{9}$/.test(str)) str = str.slice(1);
  return str;
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

function send(res, obj) { return res.status(200).json(obj); }

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") return send(res, { ok: false, error: "Invalid method." });

  try {
    let body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const action = String(body.action || "").toLowerCase();

    // REGISTER / SIGNUP (Phone or Email)
    if (action === "signup") {
      const id = normalizeId(body.phone || body.email || body.username);
      const name = String(body.name || "").trim().slice(0, 40);
      const password = String(body.password || "");

      if (!id || id.length < 3) return send(res, { ok: false, error: "Valid mobile phone number or email required." });
      if (password.length < 6) return send(res, { ok: false, error: "Password must be at least 6 characters." });

      const { salt, hash } = hashPassword(password);
      const user = { id: id, phone: body.phone || id, name: name || id, salt: salt, hash: hash, createdAt: Date.now() };

      const created = await redis("SET", "user:" + id, JSON.stringify(user), "NX");
      if (created !== "OK") return send(res, { ok: false, error: "This mobile number/email is already registered." });

      const token = await createSession(id);
      return send(res, { ok: true, token: token, user: { id: id, name: user.name } });
    }

    // LOGIN (Phone or Email)
    if (action === "login") {
      const id = normalizeId(body.phone || body.email || body.username);
      const password = String(body.password || "");

      const raw = await redis("GET", "user:" + id);
      const user = raw ? JSON.parse(raw) : null;

      if (!user || !verifyPassword(password, user.salt, user.hash)) {
        return send(res, { ok: false, error: "Incorrect phone number/email or password." });
      }

      const token = await createSession(id);
      return send(res, { ok: true, token: token, user: { id: id, name: user.name || id } });
    }

    // AUTO-RESTORE SESSION ON RELOAD (Never Logout Automatically)
    if (action === "me") {
      const token = getToken(req, body);
      if (!token) return send(res, { ok: false, error: "Not signed in." });
      const id = await redis("GET", "session:" + token);
      if (!id) return send(res, { ok: false, error: "Session expired." });
      const raw = await redis("GET", "user:" + id);
      const user = raw ? JSON.parse(raw) : {};
      return send(res, { ok: true, user: { id: id, name: user.name || id } });
    }

    // FORGOT PASSWORD AUTHORIZATION (Phone verification workflow)
    if (action === "forgot-password") {
      const id = normalizeId(body.phone || body.email);
      const newPassword = String(body.newPassword || "");

      if (!id || newPassword.length < 6) return send(res, { ok: false, error: "Provide registered phone number and 6+ char new password." });

      const raw = await redis("GET", "user:" + id);
      if (!raw) return send(res, { ok: false, error: "Mobile number not found in record." });

      let user = JSON.parse(raw);
      const { salt, hash } = hashPassword(newPassword);
      user.salt = salt;
      user.hash = hash;

      await redis("SET", "user:" + id, JSON.stringify(user));
      return send(res, { ok: true, message: "Password reset successful! You can now sign in." });
    }

    // LOGOUT
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
