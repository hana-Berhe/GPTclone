import crypto from "node:crypto";
import config from "../config/env.js";

// Minimal HS256 JSON Web Token implementation using Node's crypto module.
const encode = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
const sign = (data) =>
  crypto.createHmac("sha256", config.jwt.secret).update(data).digest("base64url");

const HEADER = encode({ alg: "HS256", typ: "JWT" });

export function createToken(userId) {
  const now = Math.floor(Date.now() / 1000);
  const payload = encode({
    sub: String(userId),
    iat: now,
    exp: now + config.jwt.expiresInDays * 24 * 60 * 60,
  });
  return `${HEADER}.${payload}.${sign(`${HEADER}.${payload}`)}`;
}

// Returns the user id, or null if the token is invalid or expired.
export function verifyToken(token) {
  if (typeof token !== "string") return null;

  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== HEADER) return null;

  const expected = Buffer.from(sign(`${parts[0]}.${parts[1]}`));
  const actual = Buffer.from(parts[2]);
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    const userId = Number(payload.sub);
    return Number.isSafeInteger(userId) && userId > 0 ? userId : null;
  } catch {
    return null;
  }
}
