import {
  deleteChatService,
  getChatService,
  listChatsService,
  renameChatService,
  streamReplyService,
} from "../service/chat.service.js";

// Input is already validated and cleaned by the validate() middleware (req.validated).

export async function listChatsController(req, res) {
  const chats = await listChatsService(req.userId);
  res.status(200).json({ status: "success", data: { chats } });
}

export async function getChatController(req, res) {
  const result = await getChatService(req.userId, req.validated.chatId);
  res.status(200).json({ status: "success", data: result });
}

export async function renameChatController(req, res) {
  const { chatId, title } = req.validated;
  const chat = await renameChatService(req.userId, chatId, title);
  res.status(200).json({ status: "success", message: "Chat renamed.", data: { chat } });
}

export async function deleteChatController(req, res) {
  await deleteChatService(req.userId, req.validated.chatId);
  res.status(200).json({ status: "success", message: "Chat deleted." });
}

// Streams the answer with Server-Sent Events so text appears word by word.
export async function streamMessageController(req, res) {
  const abortController = new AbortController();
  // Client closed the tab or pressed "Stop"
  res.on("close", () => {
    if (!res.writableEnded) abortController.abort();
  });

  const events = streamReplyService({
    userId: req.userId,
    chatId: req.validated.chatId ?? null,
    question: req.validated.question,
    signal: abortController.signal,
  });

  // The chat lookup runs before the first event. If it fails (e.g. chat not
  // found), the error is thrown here and the error handler sends normal JSON.
  const first = await events.next();

  res.status(200).set({
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

  try {
    if (!first.done) send(first.value.type, first.value.data);
    for await (const event of events) send(event.type, event.data);
  } catch (error) {
    if (!(error.status && error.status < 500)) console.error("Stream error:", error.message);
    send("error", {
      message: error.status ? error.message : "Something went wrong while generating the answer.",
    });
  } finally {
    res.end();
  }
}
