import { matchedData, validationResult } from "express-validator";

export const validate = (rules) => [
  ...rules,
  (req, res, next) => {
    const result = validationResult(req);

    if (result.isEmpty()) {
      req.validated = matchedData(req);
      return next();
    }

    const errors = {};
    for (const error of result.array({ onlyFirstError: true })) {
      if (error.type === "field" && !(error.path in errors)) {
        errors[error.path] = error.msg;
      }
    }

    const messages = Object.values(errors);
    return res.status(400).json({
      status: "error",
      message: messages[0] ?? "Invalid request.",
      errors,
    });
  },
];
