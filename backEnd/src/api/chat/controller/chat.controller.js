import { StatusCodes } from "http-status-codes";
import {
  listChatsService,
  getChatService,
  renameChatService,
  deleteChatService,
  sendMessageService,
} from "../service/chat.service.js";

// req.validated holds only the checked and cleaned fields (see validation-handler.js)

const listChatsController = async (req, res, next) => {
  try {
    const chats = await listChatsService(req.user.id);
    res.status(StatusCodes.OK).json({ status: "success", data: { chats } });
  } catch (error) {
    next(error);
  }
};

const getChatController = async (req, res, next) => {
  try {
    const result = await getChatService(req.user.id, req.validated.chatId);
    res.status(StatusCodes.OK).json({ status: "success", data: result });
  } catch (error) {
    next(error);
  }
};

const renameChatController = async (req, res, next) => {
  try {
    const { chatId, title } = req.validated;
    const chat = await renameChatService(req.user.id, chatId, title);
    res.status(StatusCodes.OK).json({ status: "success", message: "Chat renamed.", data: { chat } });
  } catch (error) {
    next(error);
  }
};

const deleteChatController = async (req, res, next) => {
  try {
    await deleteChatService(req.user.id, req.validated.chatId);
    res.status(StatusCodes.OK).json({ status: "success", message: "Chat deleted." });
  } catch (error) {
    next(error);
  }
};

// Sends the answer with Server-Sent Events, so the text appears word by word
const sendMessageController = async (req, res, next) => {
  // The user closed the tab or pressed "Stop"
  const abortController = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) abortController.abort();
  });

  const events = sendMessageService({
    userId: req.user.id,
    chatId: req.validated.chatId ?? null,
    question: req.validated.question,
    signal: abortController.signal,
  });

  // The chat lookup happens before the first event. If it fails (for example
  // "Chat not found"), nothing was streamed yet, so send a normal JSON error.
  let first;
  try {
    first = await events.next();
  } catch (error) {
    return next(error);
  }

  res.status(StatusCodes.OK).set({
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();

  const send = (event, data) => {
    if (!res.writableEnded && !res.destroyed) {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    }
  };

  // From here the response is already streaming, so errors are sent as an "error" event
  try {
    if (!first.done) send(first.value.type, first.value.data);
    for await (const event of events) send(event.type, event.data);
  } catch (error) {
    if (!error.statusCode || error.statusCode >= 500) console.error("Stream error:", error.message);
    send("error", {
      message: error.statusCode
        ? error.message
        : "Something went wrong while generating the answer.",
    });
  } finally {
    res.end();
  }
};

export {
  listChatsController,
  getChatController,
  renameChatController,
  deleteChatController,
  sendMessageController,
};
