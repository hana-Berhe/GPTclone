import { StatusCodes } from "http-status-codes";

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  // Body that isn't valid JSON, or is too big (thrown by express.json())
  if (err.type === "entity.parse.failed") {
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ status: "error", message: "Request body must be valid JSON." });
  }
  if (err.type === "entity.too.large") {
    return res
      .status(StatusCodes.REQUEST_TOO_LONG)
      .json({ status: "error", message: "Request body is too large." });
  }

  let customError = {
    statusCode: err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR,
    // Never send internal details (SQL errors, stack traces) to the user
    message: err.statusCode ? err.message : "Something went wrong. Please try again later.",
  };

  if (err?.code === "ER_DUP_ENTRY") {
    customError.statusCode = StatusCodes.CONFLICT;
    customError.message = "This already exists.";
  }

  if (customError.statusCode === StatusCodes.INTERNAL_SERVER_ERROR) {
    console.error(err);
  }

  if (res.headersSent) return next(err);

  return res.status(customError.statusCode).json({
    status: "error",
    message: customError.message,
    // Validation errors also send one message per field
    ...(err.errors && { errors: err.errors }),
  });
};

// A request that matched no route ends here, so the client gets JSON, not HTML
export const notFound = (req, res) =>
  res
    .status(StatusCodes.NOT_FOUND)
    .json({ status: "error", message: `Route ${req.method} ${req.originalUrl} not found.` });
