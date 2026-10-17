import { verifyToken } from "../utility/token.js";
import { UnauthenticatedError } from "../utility/errors/errors.js";

// The frontend sends the token as "Authorization: Bearer <token>"
const authenticateUser = (req, res, next) => {
  const header = req.get("authorization") || "";
  const [scheme, token] = header.split(" ");

  const userId = scheme === "Bearer" ? verifyToken(token) : null;
  if (!userId) {
    throw new UnauthenticatedError("Your session has expired. Please log in again.");
  }

  req.user = { id: userId };
  next();
};

export { authenticateUser };
