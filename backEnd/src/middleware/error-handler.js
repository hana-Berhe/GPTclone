export const notFoundHandler = (req, res) => {
  res
    .status(404)
    .json({ status: "error", message: `Route ${req.method} ${req.originalUrl} not found.` });
};

export const errorHandler = (err, req, res, next) => {
  // Malformed JSON body
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ status: "error", message: "Request body must be valid JSON." });
  }
  if (err.type === "entity.too.large") {
    return res.status(413).json({ status: "error", message: "Request body is too large." });
  }

  const status = err.status || 500;
  if (status >= 500) console.error("Unhandled error:", err);

  if (res.headersSent) return next(err);

  res.status(status).json({
    status: "error",
    // Never leak internal details (SQL errors, stack traces) to the client.
    message: status >= 500 ? "Something went wrong. Please try again later." : err.message,
  });
};
