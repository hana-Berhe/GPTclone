// Instant checks in the browser so users see mistakes before a request is sent.
// They mirror the server rules in backEnd/src/api/auth/validation/auth.validation.js.
// The server always validates again: browser checks can be bypassed.

export const AUTH_LIMITS = Object.freeze({ NAME_MAX: 80, PASSWORD_MIN: 8, PASSWORD_MAX: 200 });

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * @param {{ name: string, email: string, password: string }} form
 * @param {"login" | "register"} mode
 * @returns {Record<string, string>} An empty object when everything is valid.
 */
export function validateAuthForm({ name, email, password }, mode) {
  const errors = {};
  const cleanEmail = email.trim();

  if (mode === "register") {
    if (!name.trim()) errors.name = "Please enter your name.";
    else if (name.trim().length > AUTH_LIMITS.NAME_MAX) {
      errors.name = `Name must be ${AUTH_LIMITS.NAME_MAX} characters or fewer.`;
    }
  }

  if (!cleanEmail) errors.email = "Please enter your email address.";
  else if (mode === "register" && !EMAIL_PATTERN.test(cleanEmail)) {
    errors.email = "Please enter a valid email address.";
  }

  if (!password) {
    errors.password =
      mode === "register" ? "Please enter a password." : "Please enter your password.";
  } else if (mode === "register" && password.length < AUTH_LIMITS.PASSWORD_MIN) {
    errors.password = `Password must be at least ${AUTH_LIMITS.PASSWORD_MIN} characters.`;
  } else if (mode === "register" && password.length > AUTH_LIMITS.PASSWORD_MAX) {
    errors.password = `Password must be ${AUTH_LIMITS.PASSWORD_MAX} characters or fewer.`;
  }

  return errors;
}
