import { body, param } from "express-validator";
import { validationErrorHandler } from "../../../middleware/validation-handler.js";

export const QUESTION_MAX = 20000;
export const CHAT_TITLE_MAX = 80;

const ID_OPTIONS = { min: 1, max: Number.MAX_SAFE_INTEGER };

const collapseSpaces = (value) => value.replace(/\s+/g, " ").trim();

const chatIdParam = () =>
  param("chatId").isInt(ID_OPTIONS).withMessage("Invalid chat id.").bail().toInt();

export const chatIdValidation = [chatIdParam(), validationErrorHandler];

export const renameChatValidation = [
  chatIdParam(),
  body("title")
    .isString()
    .withMessage("Title cannot be empty.")
    .bail()
    .customSanitizer(collapseSpaces)
    .notEmpty()
    .withMessage("Title cannot be empty.")
    .bail()
    .isLength({ max: CHAT_TITLE_MAX })
    .withMessage(`Title must be ${CHAT_TITLE_MAX} characters or fewer.`),

  validationErrorHandler,
];

export const sendMessageValidation = [
  // Leave chatId out (or send null) to start a new chat
  body("chatId")
    .optional({ values: "null" })
    .isInt(ID_OPTIONS)
    .withMessage("Invalid chat id.")
    .bail()
    .toInt(),
  body("question")
    .isString()
    .withMessage("Message cannot be empty.")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("Message cannot be empty.")
    .bail()
    .isLength({ max: QUESTION_MAX })
    .withMessage(`Message is too long (max ${QUESTION_MAX} characters).`),

  validationErrorHandler,
];
