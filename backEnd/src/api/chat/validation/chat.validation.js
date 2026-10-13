import { body, param } from "express-validator";
import { LIMITS } from "../../../constants/limits.js";

const ID_OPTIONS = { min: 1, max: Number.MAX_SAFE_INTEGER };

const collapseSpaces = (value) => value.replace(/\s+/g, " ").trim();

const chatIdParam = param("chatId")
  .isInt(ID_OPTIONS)
  .withMessage("Invalid chat id.")
  .bail()
  .toInt();

export const chatIdRules = [chatIdParam];

export const renameChatRules = [
  chatIdParam,
  body("title")
    .isString()
    .withMessage("Title cannot be empty.")
    .bail()
    .customSanitizer(collapseSpaces)
    .notEmpty()
    .withMessage("Title cannot be empty.")
    .bail()
    .isLength({ max: LIMITS.CHAT_TITLE_MAX })
    .withMessage(`Title must be ${LIMITS.CHAT_TITLE_MAX} characters or fewer.`),
];

export const streamMessageRules = [
  // Leave chatId out (or send null) to start a new chat.
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
    .isLength({ max: LIMITS.QUESTION_MAX })
    .withMessage(`Message is too long (max ${LIMITS.QUESTION_MAX} characters).`),
];
