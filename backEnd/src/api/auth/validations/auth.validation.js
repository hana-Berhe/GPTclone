import { body } from "express-validator";
import { validationErrorHandler } from "../../../middleware/validation-handler.js";

const NAME_MAX = 80;
const EMAIL_MAX = 255;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 200;

// Lowercase and trim only. express-validator's normalizeEmail() is not used on
// purpose: it changes some addresses (for example, removes dots in Gmail).
const normalizeEmail = (value) => value.trim().toLowerCase();

export const registerValidation = [
  body("name")
    .isString()
    .withMessage("Please enter your name.")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("Please enter your name.")
    .bail()
    .isLength({ max: NAME_MAX })
    .withMessage(`Name must be ${NAME_MAX} characters or fewer.`),
  body("email")
    .isString()
    .withMessage("Please enter your email address.")
    .bail()
    .customSanitizer(normalizeEmail)
    .notEmpty()
    .withMessage("Please enter your email address.")
    .bail()
    .isLength({ max: EMAIL_MAX })
    .withMessage("Email address is too long.")
    .bail()
    .isEmail()
    .withMessage("Please enter a valid email address."),
  // Passwords are never trimmed: spaces are valid characters
  body("password")
    .isString()
    .withMessage("Please enter a password.")
    .bail()
    .isLength({ min: PASSWORD_MIN })
    .withMessage(`Password must be at least ${PASSWORD_MIN} characters.`)
    .bail()
    .isLength({ max: PASSWORD_MAX })
    .withMessage(`Password must be ${PASSWORD_MAX} characters or fewer.`),

  validationErrorHandler,
];

// Login only checks that something was entered. Whether it's correct is
// decided by the service, with one message for both mistakes.
export const loginValidation = [
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

  validationErrorHandler,
];
