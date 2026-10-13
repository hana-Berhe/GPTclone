import { body } from "express-validator";
import { LIMITS } from "../../../constants/limits.js";

// Lowercase and trim only. express-validator's normalizeEmail() is avoided on
// purpose: by default it rewrites some addresses (e.g. removes dots in Gmail).
const normalizeEmail = (value) => value.trim().toLowerCase();

export const registerRules = [
  body("name")
    .isString()
    .withMessage("Please enter your name.")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("Please enter your name.")
    .bail()
    .isLength({ max: LIMITS.NAME_MAX })
    .withMessage(`Name must be ${LIMITS.NAME_MAX} characters or fewer.`),

  body("email")
    .isString()
    .withMessage("Please enter your email address.")
    .bail()
    .customSanitizer(normalizeEmail)
    .notEmpty()
    .withMessage("Please enter your email address.")
    .bail()
    .isLength({ max: LIMITS.EMAIL_MAX })
    .withMessage("Email address is too long.")
    .bail()
    .isEmail()
    .withMessage("Please enter a valid email address."),

  // Passwords are never trimmed: spaces are valid characters.
  body("password")
    .isString()
    .withMessage("Please enter a password.")
    .bail()
    .isLength({ min: LIMITS.PASSWORD_MIN })
    .withMessage(`Password must be at least ${LIMITS.PASSWORD_MIN} characters.`)
    .bail()
    .isLength({ max: LIMITS.PASSWORD_MAX })
    .withMessage(`Password must be ${LIMITS.PASSWORD_MAX} characters or fewer.`),
];

// Login only checks that something was entered. Whether it's correct is
// decided by the service, with one generic message for both mistakes.
export const loginRules = [
  body("email")
    .isString()
    .withMessage("Please enter your email address.")
    .bail()
    .customSanitizer(normalizeEmail)
    .notEmpty()
    .withMessage("Please enter your email address."),

  body("password")
    .isString()
    .withMessage("Please enter your password.")
    .bail()
    .notEmpty()
    .withMessage("Please enter your password."),
];
