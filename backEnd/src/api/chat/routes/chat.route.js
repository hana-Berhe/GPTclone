import express from "express";
import config from "../../../config/env.js";
import { requireAuth } from "../../../middleware/auth.js";
import { rateLimit } from "../../../middleware/rate-limit.js";
import { validate } from "../../../middleware/validate.js";
import {
  deleteChatController,
  getChatController,
  listChatsController,
  renameChatController,
  streamMessageController,
} from "../controller/chat.controller.js";
import { chatIdRules, renameChatRules, streamMessageRules } from "../validation/chat.validation.js";

const chatRouter = express.Router();

// Each message costs a Gemini request, so limit how fast one account can send them.
const messageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.rateLimit.messagesPerMin,
  message: "You're sending messages too quickly. Please wait a moment.",
  keyBy: (req) => `user:${req.userId}`,
});

// Every chat route needs a logged-in user.
chatRouter.use(requireAuth);

// /api/chats
chatRouter.get("/", listChatsController);
// Send a message (chatId in body; omit it to start a new chat). Streams the answer.
chatRouter.post("/stream", messageLimiter, validate(streamMessageRules), streamMessageController);
chatRouter.get("/:chatId", validate(chatIdRules), getChatController);
chatRouter.patch("/:chatId", validate(renameChatRules), renameChatController);
chatRouter.delete("/:chatId", validate(chatIdRules), deleteChatController);

export default chatRouter;
