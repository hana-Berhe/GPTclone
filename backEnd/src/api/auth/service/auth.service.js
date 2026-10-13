import { hashPassword, verifyPassword } from "../../../lib/password.js";
import { createToken } from "../../../lib/token.js";
import { conflict, unauthorized } from "../../../utils/http-error.js";
import { createUser, findUserByEmail, findUserById } from "../model/auth.model.js";

// Input shape (lengths, email format, ...) is checked in ../validation/auth.validation.js.
// The service only handles rules that need the database.

const EMAIL_TAKEN = "An account with this email already exists. Try logging in.";

// Used so that "unknown email" and "wrong password" take the same amount of time.
let dummyHashPromise;
const getDummyHash = () => (dummyHashPromise ??= hashPassword("not-a-real-password"));

export async function registerService({ name, email, password }) {
  if (await findUserByEmail(email)) throw conflict(EMAIL_TAKEN);

  try {
    const user = await createUser({ name, email, passwordHash: await hashPassword(password) });
    return { user, token: createToken(user.id) };
  } catch (error) {
    // Two sign-ups with the same email at the same moment
    if (error.code === "ER_DUP_ENTRY") throw conflict(EMAIL_TAKEN);
    throw error;
  }
}

export async function loginService({ email, password }) {
  const user = await findUserByEmail(email);
  const passwordOk = await verifyPassword(password, user?.passwordHash ?? (await getDummyHash()));

  if (!user || !passwordOk) throw unauthorized("Incorrect email or password.");

  const { passwordHash: _passwordHash, ...safeUser } = user;
  return { user: safeUser, token: createToken(user.id) };
}

export async function getCurrentUserService(userId) {
  const user = await findUserById(userId);
  if (!user) throw unauthorized("Your account no longer exists. Please sign up again.");
  return user;
}
