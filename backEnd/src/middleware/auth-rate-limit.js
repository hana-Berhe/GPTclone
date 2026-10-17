import { TooManyRequestsError } from "../utility/errors/errors.js";

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = Number(process.env.RATE_LIMIT_AUTH_PER_15_MIN) || 20;
const MAX_TRACKED_IPS = 10000; // stops the Map from growing forever

/**
 * Makes one per-IP rate-limit middleware for a public auth route.
 * Every call has its own Map, so login and register keep separate counts:
 * an IP that is blocked on login can still register, and the reverse.
 *
 * Every attempt counts, successful or not.
 *
 * @param {Object} [options]
 * @param {number} [options.max] - Attempts allowed per IP in one window.
 * @param {number} [options.windowMs] - Window length in milliseconds.
 * @param {number} [options.maxTrackedIps] - Most IPs remembered at once.
 * @returns {(req, res, next) => void}
 */
export const createAuthRateLimit = ({
  max = MAX_ATTEMPTS,
  windowMs = WINDOW_MS,
  maxTrackedIps = MAX_TRACKED_IPS,
} = {}) => {
  /*
    Map: ip -> { count, resetAt }
      count   = attempts from this IP in the current window
      resetAt = time (ms) when the window ends and count starts again from 0
  */
  const attemptsByIp = new Map();

  return (req, res, next) => {
    const now = Date.now();
    const ip = req.ip || req.socket?.remoteAddress || "unknown";

    let entry = attemptsByIp.get(ip);
    if (!entry || entry.resetAt <= now) {
      // Delete first, so a reset IP moves to the end of the Map (newest).
      attemptsByIp.delete(ip);
      if (attemptsByIp.size >= maxTrackedIps) {
        // Forget the oldest IP to make room.
        attemptsByIp.delete(attemptsByIp.keys().next().value);
      }
      entry = { count: 0, resetAt: now + windowMs };
      attemptsByIp.set(ip, entry);
    }
    entry.count += 1;

    if (entry.count > max) {
      const minutes = Math.ceil((entry.resetAt - now) / 60000);
      res.set("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
      return next(
        new TooManyRequestsError(
          `Too many attempts. Please wait ${minutes} minute${minutes === 1 ? "" : "s"} and try again.`,
        ),
      );
    }

    next();
  };
};

// One limiter per route, so each has its own budget of attempts.
export const loginRateLimit = createAuthRateLimit();
export const registerRateLimit = createAuthRateLimit();
