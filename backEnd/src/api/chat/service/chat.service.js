import config from "../../../config/env.js";
import { LIMITS } from "../../../constants/limits.js";
import { generateTitle, streamAnswer } from "../../../lib/gemini.js";
import { HttpError, notFound } from "../../../utils/http-error.js";
import {
  createChat,
  createMessage,
  deleteChat,
  findChatForUser,
  getMessagesByChat,
  getRecentMessages,
  listChatsByUser,
  touchChat,
  updateChatTitle,
} from "../model/chat.model.js";

// Input shape (ids, lengths, empty values) is checked in ../validation/chat.validation.js.
// The service handles rules that need the database, such as chat ownership.

const HISTORY_LIMIT = 20; // how many earlier messages Gemini sees as context

// "How do I center a div in CSS when..." -> "How do I center a div in CSS…"
const fallbackTitle = (question) => {
  const oneLine = question.replace(/\s+/g, " ").trim();
  if (oneLine.length <= 50) return oneLine;
  const cut = oneLine.slice(0, 50);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 20 ? lastSpace : 50)}…`;
};

// Turn Gemini/SDK errors into something a user can act on.
const toFriendlyError = (error) => {
  const status = error?.status ?? error?.code;
  if (status === 429) {
    return new HttpError(
      429,
      "The AI service is busy right now (rate limit reached). Please wait a moment and try again.",
    );
  }
  if (status === 401 || status === 403) {
    return new HttpError(
      502,
      "The AI service rejected the API key. Check GEMINI_API_KEY in the backend .env file.",
    );
  }
  if (status === 404) {
    return new HttpError(
      502,
      `The model "${config.gemini.model}" was not found. Check GEMINI_MODEL in the backend .env file.`,
    );
  }
  if (error instanceof HttpError) return error;
  return new HttpError(502, "The AI service failed to respond. Please try again.");
};

export async function listChatsService(userId) {
  return listChatsByUser(userId);
}

export async function getChatService(userId, chatId) {
  const chat = await findChatForUser(chatId, userId);
  if (!chat) throw notFound("Chat not found.");
  const messages = await getMessagesByChat(chat.id);
  return { chat, messages };
}

export async function renameChatService(userId, chatId, title) {
  const updated = await updateChatTitle(chatId, userId, title);
  if (!updated) throw notFound("Chat not found.");
  return findChatForUser(chatId, userId);
}

export async function deleteChatService(userId, chatId) {
  const deleted = await deleteChat(chatId, userId);
  if (!deleted) throw notFound("Chat not found.");
}

/**
 * Sends a message and streams the answer.
 * Yields events: meta -> delta* -> done -> title (only for new chats).
 * Anything thrown before the first yield becomes a normal JSON error response.
 *
 * @param {{ userId: number, chatId: number | null, question: string, signal?: AbortSignal }} input
 *   question is already trimmed and non-empty (see chat.validation.js).
 */
export async function* streamReplyService({ userId, chatId, question, signal }) {
  const text = question;

  // 1. Find the chat (it must belong to this user), or start a new one
  let chat;
  let isNewChat = false;
  if (chatId !== null) {
    chat = await findChatForUser(chatId, userId);
    if (!chat) throw notFound("Chat not found.");
  } else {
    chat = await createChat(userId, fallbackTitle(text));
    isNewChat = true;
  }

  // 2. Load earlier messages of THIS chat as context (before saving the new one)
  const history = await getRecentMessages(chat.id, HISTORY_LIMIT);

  // 3. Save the user's message right away so it survives even if the AI call fails
  const userMessage = await createMessage({ chatId: chat.id, role: "user", content: text });
  await touchChat(chat.id);

  yield { type: "meta", data: { chat, isNewChat, userMessage } };

  // 4. Stream the answer from Gemini
  let answer = "";
  let totalTokens = 0;
  try {
    for await (const part of streamAnswer({ history, question: text, signal })) {
      if (signal?.aborted) break;
      if (part.text) {
        answer += part.text;
        yield { type: "delta", data: { text: part.text } };
      }
      if (part.totalTokens) totalTokens = part.totalTokens;
    }
  } catch (error) {
    // User pressed "Stop": keep whatever was generated so far.
    if (!signal?.aborted) {
      console.error("Gemini error:", error);
      throw toFriendlyError(error);
    }
  }

  if (!answer.trim()) {
    if (signal?.aborted) return;
    throw new HttpError(
      502,
      "The model returned an empty response (it may have been blocked by safety filters). Try rephrasing.",
    );
  }

  // 5. Save the answer (also when stopped early, like ChatGPT)
  const assistantMessage = await createMessage({
    chatId: chat.id,
    role: "assistant",
    content: answer,
    tokenCount: totalTokens,
  });
  await touchChat(chat.id);

  if (signal?.aborted) return;
  yield { type: "done", data: { assistantMessage } };

  // 6. Give new chats a proper title
  if (isNewChat) {
    try {
      const title = (await generateTitle(text)).slice(0, LIMITS.CHAT_TITLE_MAX);
      if (title) {
        await updateChatTitle(chat.id, userId, title);
        yield { type: "title", data: { chatId: chat.id, title } };
      }
    } catch (error) {
      console.warn("Could not generate chat title:", error.message);
    }
  }
}
