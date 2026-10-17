// A small rate limit per logged-in user.
// Sending a message uses it, because every message costs a Gemini call.
//
// It is a counter in memory: no package and no database table. It is reset
// when the server restarts, and that is fine for this job. It remembers at
// most `maxTrackedUsers` users, so the Map cannot grow forever.
// Use it AFTER authenticateUser, because it needs req.user.id.

import { TooManyRequestsError } from "../utility/errors/errors.js";

/**
 * Makes one rate-limit middleware. Every call has its own counters, so two
 * limits never share a count.
 * @param {Object} options
 * @param {number} options.max - Requests allowed per user in one window.
 * @param {number} [options.windowMs=60000] - Window length in milliseconds.
 * @param {string} [options.what="requests"] - The word used in the message.
 * @param {number} [options.maxTrackedUsers=10000] - Most users remembered at
 *   once. When full, the user who started a window longest ago is forgotten.
 * @returns {(req, res, next) => void}
 */
export const createUserRateLimit = ({
  max,
  windowMs = 60 * 1000,
  what = "requests",
  maxTrackedUsers = 10000,
}) => {
  const requestCounts = new Map();

  return (req, res, next) => {
    const now = Date.now();

    const userId = req.user.id;
    let entry = requestCounts.get(userId);
    if (!entry || entry.resetAt <= now) {
      // Delete first, so a reset user moves to the end of the Map (newest).
      requestCounts.delete(userId);
      if (requestCounts.size >= maxTrackedUsers) {
        // Forget the oldest user to make room.
        requestCounts.delete(requestCounts.keys().next().value);
      }
      entry = { count: 0, resetAt: now + windowMs };
      requestCounts.set(userId, entry);
    }
    entry.count += 1;

    if (entry.count > max) {
      const seconds = Math.ceil((entry.resetAt - now) / 1000);
      res.set("Retry-After", String(seconds));
      return next(
        new TooManyRequestsError(
          `Too many ${what}. Please wait ${seconds} seconds and try again.`,
        ),
      );
    }

    next();
  };
};
