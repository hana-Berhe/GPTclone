import { safeExecute } from "../../../../schema/db.config.js";
import { hashPassword, verifyPassword } from "../../../utility/password.js";
import { createToken } from "../../../utility/token.js";
import { ConflictError, UnauthenticatedError } from "../../../utility/errors/errors.js";

const EMAIL_TAKEN = "An account with this email already exists. Try logging in.";

// Compared against when the email doesn't exist, so "unknown email" and
// "wrong password" take the same time and can't reveal who is registered.
let unknownUserHashPromise;
const getUnknownUserHash = () => (unknownUserHashPromise ??= hashPassword("unknown-user-placeholder"));

// Database row -> the user object the frontend gets (never the password hash)
const toUser = (row) => ({
  id: Number(row.id),
  name: row.name,
  email: row.email,
  createdAt: row.created_at,
});

const findUserById = async (userId) => {
  const rows = await safeExecute(
    "SELECT id, name, email, created_at FROM users WHERE id = ? LIMIT 1",
    [userId],
  );
  return rows[0] ? toUser(rows[0]) : null;
};

/**
 * Creates a new account and logs the user in.
 * @returns {Promise<{user: Object, token: string}>}
 */
export const registerService = async ({ name, email, password }) => {
  const rows = await safeExecute("SELECT id FROM users WHERE email = ? LIMIT 1", [email]);
  if (rows.length > 0) {
    throw new ConflictError(EMAIL_TAKEN);
  }

  let result;
  try {
    result = await safeExecute(
      "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
      [name, email, await hashPassword(password)],
    );
  } catch (error) {
    // Two sign-ups with the same email at the same moment
    if (error?.code === "ER_DUP_ENTRY") throw new ConflictError(EMAIL_TAKEN);
    throw error;
  }

  const user = await findUserById(result.insertId);
  return { user, token: createToken(user.id) };
};

/**
 * Checks the email and password.
 * @returns {Promise<{user: Object, token: string}>}
 */
export const loginService = async ({ email, password }) => {
  const rows = await safeExecute(
    "SELECT id, name, email, password_hash, created_at FROM users WHERE email = ? LIMIT 1",
    [email],
  );
  const row = rows[0];

  const isMatch = await verifyPassword(
    password,
    row?.password_hash ?? (await getUnknownUserHash()),
  );

  if (!row || !isMatch) {
    throw new UnauthenticatedError("Incorrect email or password.");
  }

  return { user: toUser(row), token: createToken(row.id) };
};

export const getCurrentUserService = async (userId) => {
  const user = await findUserById(userId);
  if (!user) {
    throw new UnauthenticatedError("Your account no longer exists. Please sign up again.");
  }
  return user;
};
