import { matchedData, validationResult } from "express-validator";
import { BadRequestError } from "../utility/errors/errors.js";

// Runs after the validation rules. On success, req.validated holds only the
// checked and cleaned fields, so unexpected input never reaches a service.
export const validationErrorHandler = (req, res, next) => {
  const result = validationResult(req);

  if (result.isEmpty()) {
    req.validated = matchedData(req);
    return next();
  }

  // One message per field, so the form can show each one under its input
  const errors = {};
  for (const error of result.array({ onlyFirstError: true })) {
    if (error.type === "field" && !(error.path in errors)) {
      errors[error.path] = error.msg;
    }
  }

  const badRequest = new BadRequestError(Object.values(errors)[0] ?? "Invalid request.");
  badRequest.errors = errors;
  throw badRequest;
};
