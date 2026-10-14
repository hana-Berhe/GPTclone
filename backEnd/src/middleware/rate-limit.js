/**
 * Simple in-memory rate limiter (fixed window).
 *
 * Counts requests per key (by default the visitor's IP address) and answers 429 once
 * `max` is exceeded within `windowMs`. Counters live in this server's memory, which is
 * right for a single instance. With several instances, use a shared store such as Redis.
 *
 * @param {object} options
 * @param {number} options.windowMs Length of the window in milliseconds.
 * @param {number} options.max Requests allowed per key in one window.
 * @param {string} options.message Error message for the user.
 * @param {(req: import("express").Request) => string} [options.keyBy] Builds the key.
 */
export function rateLimit({ windowMs, max, message, keyBy = (req) => req.ip }) {
  const hits = new Map(); // key -> { count, resetAt }

  // Forget expired entries so memory doesn't grow forever.
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(key);
    }
  }, windowMs);
  cleanup.unref();

  return (req, res, next) => {
    const now = Date.now();
    const key = keyBy(req);

    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;

    const secondsLeft = Math.ceil((entry.resetAt - now) / 1000);
    res.set("RateLimit-Limit", String(max));
    res.set("RateLimit-Remaining", String(Math.max(0, max - entry.count)));
    res.set("RateLimit-Reset", String(secondsLeft));

    if (entry.count > max) {
      res.set("Retry-After", String(secondsLeft));
      return res.status(429).json({ status: "error", message });
    }
    next();
  };
}
