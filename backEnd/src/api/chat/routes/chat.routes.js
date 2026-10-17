import express from "express";
import {
  listChatsController,
  getChatController,
  renameChatController,
  deleteChatController,
  sendMessageController,
} from "../controller/chat.controller.js";
import {
  chatIdValidation,
  renameChatValidation,
  sendMessageValidation,
} from "../validations/chat.validation.js";
import { authenticateUser } from "../../../middleware/authentication.js";
import { createUserRateLimit } from "../../../middleware/user-rate-limit.js";

const chatRouter = express.Router();

// Every message costs a Gemini call, so limit how fast one account can send them
const messageRateLimit = createUserRateLimit({
  max: Number(process.env.RATE_LIMIT_MESSAGES_PER_MIN) || 15,
  what: "messages",
});

// Every chat route needs a logged-in user
chatRouter.use(authenticateUser);

/**
 * @route GET /api/chats
 * @desc List the user's chats, newest first
 * @access Protected
 */
chatRouter.get("/", listChatsController);

/**
 * @route POST /api/chats/stream
 * @desc Send a message (no chatId = new chat) and stream the answer
 * @access Protected
 */
chatRouter.post("/stream", messageRateLimit, sendMessageValidation, sendMessageController);

/**
 * @route GET /api/chats/:chatId
 * @desc Get one chat with its messages
 * @access Protected
 */
chatRouter.get("/:chatId", chatIdValidation, getChatController);

/**
 * @route PATCH /api/chats/:chatId
 * @desc Rename a chat
 * @access Protected
 */
chatRouter.patch("/:chatId", renameChatValidation, renameChatController);

/**
 * @route DELETE /api/chats/:chatId
 * @desc Delete a chat and its messages
 * @access Protected
 */
chatRouter.delete("/:chatId", chatIdValidation, deleteChatController);

export { chatRouter };
