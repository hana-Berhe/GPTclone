import { verifyToken } from "../lib/token.js";
import { unauthorized } from "../utils/http-error.js";

// Reads "Authorization: Bearer <token>" and sets req.userId.
export function requireAuth(req, res, next) {
  const header = req.get("authorization") || "";
  const [scheme, token] = header.split(" ");

  const userId = scheme === "Bearer" ? verifyToken(token) : null;
  if (!userId) {
    return next(unauthorized("Your session has expired. Please log in again."));
  }

  req.userId = userId;
  next();
}
