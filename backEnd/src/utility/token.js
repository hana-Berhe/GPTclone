import jwt from "jsonwebtoken";

const JWT_EXPIRES_IN_DAYS = Number(process.env.JWT_EXPIRES_IN_DAYS) || 7;

// The token stores the user id in "sub" (the standard JWT field for "who this is about")
export function createToken(userId) {
  return jwt.sign({ sub: String(userId) }, process.env.JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: `${JWT_EXPIRES_IN_DAYS}d`,
  });
}

// Returns the user id, or null if the token is invalid or expired
export function verifyToken(token) {
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
    const userId = Number(payload.sub);
    return Number.isSafeInteger(userId) && userId > 0 ? userId : null;
  } catch {
    return null;
  }
}
