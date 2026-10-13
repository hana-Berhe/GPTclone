import express from "express";
import { requireAuth } from "../../../middleware/auth.js";
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

// Every chat route needs a logged-in user.
chatRouter.use(requireAuth);

// /api/chats
chatRouter.get("/", listChatsController);
// Send a message (chatId in body; omit it to start a new chat). Streams the answer.
chatRouter.post("/stream", validate(streamMessageRules), streamMessageController);
chatRouter.get("/:chatId", validate(chatIdRules), getChatController);
chatRouter.patch("/:chatId", validate(renameChatRules), renameChatController);
chatRouter.delete("/:chatId", validate(chatIdRules), deleteChatController);

export default chatRouter;
