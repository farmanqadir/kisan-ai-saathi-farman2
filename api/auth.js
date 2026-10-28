const crypto = require("crypto");

const VERSION = "auth-v5-phone-otp-auth";
const SESSION_DAYS = 90;

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

// Phone Number Normalizer (e.g., 03001234567 or +923001234567 -> 923001234567)
function normalizePhone(v) {
  let str = String(v || "").trim().toLowerCase();
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

    // 1. MOBILE PHONE REGISTER / SIGNUP
    if (action === "signup") {
      const phone = normalizePhone(body.phone || body.username);
      const name = String(body.name || "").trim().slice(0, 40);
      const password = String(body.password || "");

      if (!phone || phone.length < 10) return send(res, { ok: false, error: "Valid Pakistani mobile phone number required (e.g. 03001234567)." });
      if (password.length < 6) return send(res, { ok: false, error: "Password must be at least 6 characters." });

      const { salt, hash } = hashPassword(password);
      const user = { id: phone, phone: phone, name: name || phone, salt: salt, hash: hash, createdAt: Date.now() };

      const created = await redis("SET", "user:" + phone, JSON.stringify(user), "NX");
      if (created !== "OK") return send(res, { ok: false, error: "This mobile phone number is already registered." });

      const token = await createSession(phone);
      return send(res, { ok: true, token: token, user: { id: phone, name: user.name } });
    }

    // 2. MOBILE PHONE LOGIN
    if (action === "login") {
      const phone = normalizePhone(body.phone || body.username);
      const password = String(body.password || "");

      const raw = await redis("GET", "user:" + phone);
      const user = raw ? JSON.parse(raw) : null;

      if (!user || !verifyPassword(password, user.salt, user.hash)) {
        return send(res, { ok: false, error: "Incorrect mobile number or password." });
      }

      const token = await createSession(phone);
      return send(res, { ok: true, token: token, user: { id: phone, name: user.name || phone } });
    }

    // 3. AUTO SESSION RESTORE ON RELOAD
    if (action === "me") {
      const token = getToken(req, body);
      if (!token) return send(res, { ok: false, error: "Not signed in." });
      const id = await redis("GET", "session:" + token);
      if (!id) return send(res, { ok: false, error: "Session expired." });
      const raw = await redis("GET", "user:" + id);
      const user = raw ? JSON.parse(raw) : {};
      return send(res, { ok: true, user: { id: id, name: user.name || id } });
    }

    // 4. FORGOT PASSWORD - STEP 1: REQUEST AUTHORIZATION CODE (OTP)
    if (action === "request-auth-code") {
      const phone = normalizePhone(body.phone);
      if (!phone || phone.length < 10) return send(res, { ok: false, error: "Please enter a valid registered mobile number." });

      const raw = await redis("GET", "user:" + phone);
      if (!raw) return send(res, { ok: false, error: "This mobile number is not registered." });

      // Generate 4-digit Authorization Code (OTP)
      const authCode = Math.floor(1000 + Math.random() * 9000).toString();
      await redis("SET", "authcode:" + phone, authCode, "EX", 600); // 10 minutes expiry

      return send(res, {
        ok: true,
        message: "Authorization code sent to mobile number " + phone,
        authCode: authCode // Sent to frontend for instant authorization verification
      });
    }

    // 5. FORGOT PASSWORD - STEP 2: VERIFY CODE & RESET PASSWORD
    if (action === "reset-password-with-code") {
      const phone = normalizePhone(body.phone);
      const code = String(body.authCode || "").trim();
      const newPassword = String(body.newPassword || "");

      if (!phone || !code || newPassword.length < 6) {
        return send(res, { ok: false, error: "Mobile number, 4-digit code, and 6+ char new password required." });
      }

      const savedCode = await redis("GET", "authcode:" + phone);
      if (!savedCode || savedCode !== code) {
        return send(res, { ok: false, error: "Invalid or expired authorization code." });
      }

      const raw = await redis("GET", "user:" + phone);
      if (!raw) return send(res, { ok: false, error: "Account record not found." });

      let user = JSON.parse(raw);
      const { salt, hash } = hashPassword(newPassword);
      user.salt = salt;
      user.hash = hash;

      await redis("SET", "user:" + phone, JSON.stringify(user));
      await redis("DEL", "authcode:" + phone); // Clear used code

      return send(res, { ok: true, message: "Password reset successful! Please sign in with your new password." });
    }

    // 6. LOGOUT
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
