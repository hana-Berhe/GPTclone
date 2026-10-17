import { safeExecute } from "../../../../schema/db.config.js";
import { generateTitle, streamAnswer, GEMINI_MODEL } from "./gemini.service.js";
import { CHAT_TITLE_MAX } from "../validations/chat.validation.js";
import {
  BadGatewayError,
  CustomAPIError,
  NotFoundError,
  TooManyRequestsError,
} from "../../../utility/errors/errors.js";

const HISTORY_LIMIT = 20; // how many earlier messages Gemini sees as context

// ---- database helpers ----

// Database rows -> the camelCase objects the frontend expects
const toChat = (row) => ({
  id: Number(row.id),
  title: row.title,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toMessage = (row) => ({
  id: Number(row.id),
  chatId: Number(row.chat_id),
  role: row.role,
  content: row.content,
  tokenCount: Number(row.token_count || 0),
  createdAt: row.created_at,
});

const MESSAGE_COLUMNS = "id, chat_id, role, content, token_count, created_at";

// Only finds the chat if it belongs to this user
const findChatForUser = async (chatId, userId) => {
  const rows = await safeExecute(
    `SELECT id, title, created_at, updated_at
     FROM chats
     WHERE id = ? AND user_id = ?
     LIMIT 1`,
    [chatId, userId],
  );
  return rows[0] ? toChat(rows[0]) : null;
};

const updateChatTitle = async (chatId, userId, title) => {
  const result = await safeExecute("UPDATE chats SET title = ? WHERE id = ? AND user_id = ?", [
    title,
    chatId,
    userId,
  ]);
  return result.affectedRows > 0;
};

// Moves the chat to the top of the sidebar
const touchChat = async (chatId) => {
  await safeExecute("UPDATE chats SET updated_at = CURRENT_TIMESTAMP WHERE id = ?", [chatId]);
};

const createMessage = async ({ chatId, role, content, tokenCount = 0 }) => {
  const result = await safeExecute(
    "INSERT INTO messages (chat_id, role, content, token_count) VALUES (?, ?, ?, ?)",
    [chatId, role, content, tokenCount],
  );
  const rows = await safeExecute(`SELECT ${MESSAGE_COLUMNS} FROM messages WHERE id = ? LIMIT 1`, [
    result.insertId,
  ]);
  return toMessage(rows[0]);
};

// The last messages of a chat, oldest first.
// LIMIT can't be a ? placeholder with execute(), so it is a fixed number here.
const getRecentMessages = async (chatId) => {
  const rows = await safeExecute(
    `SELECT ${MESSAGE_COLUMNS}
     FROM messages
     WHERE chat_id = ?
     ORDER BY id DESC
     LIMIT ${HISTORY_LIMIT}`,
    [chatId],
  );
  return rows.reverse().map(toMessage);
};

// "How do I center a div in CSS when..." -> "How do I center a div in CSS…"
const fallbackTitle = (question) => {
  const oneLine = question.replace(/\s+/g, " ").trim();
  if (oneLine.length <= 50) return oneLine;
  const cut = oneLine.slice(0, 50);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 20 ? lastSpace : 50)}…`;
};

// Turns Gemini errors into messages a user can act on
const toFriendlyError = (error) => {
  const status = error?.status ?? error?.code;
  if (status === 429) {
    return new TooManyRequestsError(
      "The AI service is busy right now (rate limit reached). Please wait a moment and try again.",
    );
  }
  if (status === 401 || status === 403) {
    return new BadGatewayError(
      "The AI service rejected the API key. Check GEMINI_API_KEY in the backend .env file.",
    );
  }
  if (status === 404) {
    return new BadGatewayError(
      `The model "${GEMINI_MODEL}" was not found. Check GEMINI_MODEL in the backend .env file.`,
    );
  }
  if (error instanceof CustomAPIError) return error;
  return new BadGatewayError("The AI service failed to respond. Please try again.");
};

// ---- services ----

export const listChatsService = async (userId) => {
  const rows = await safeExecute(
    `SELECT id, title, created_at, updated_at
     FROM chats
     WHERE user_id = ?
     ORDER BY updated_at DESC, id DESC`,
    [userId],
  );
  return rows.map(toChat);
};

export const getChatService = async (userId, chatId) => {
  const chat = await findChatForUser(chatId, userId);
  if (!chat) throw new NotFoundError("Chat not found.");

  const rows = await safeExecute(
    `SELECT ${MESSAGE_COLUMNS} FROM messages WHERE chat_id = ? ORDER BY id ASC`,
    [chat.id],
  );
  return { chat, messages: rows.map(toMessage) };
};

export const renameChatService = async (userId, chatId, title) => {
  const updated = await updateChatTitle(chatId, userId, title);
  if (!updated) throw new NotFoundError("Chat not found.");
  return findChatForUser(chatId, userId);
};

export const deleteChatService = async (userId, chatId) => {
  // Its messages are removed too, by ON DELETE CASCADE
  const result = await safeExecute("DELETE FROM chats WHERE id = ? AND user_id = ?", [
    chatId,
    userId,
  ]);
  if (result.affectedRows === 0) throw new NotFoundError("Chat not found.");
};

/**
 * Saves the question, streams Gemini's answer, then saves the answer.
 * Yields events in this order: meta -> delta (many) -> done -> title (new chats only).
 * An error thrown before the first event becomes a normal JSON error response.
 */
export async function* sendMessageService({ userId, chatId, question, signal }) {
  // 1. Find the chat (it must belong to this user), or start a new one
  let chat;
  let isNewChat = false;
  if (chatId !== null) {
    chat = await findChatForUser(chatId, userId);
    if (!chat) throw new NotFoundError("Chat not found.");
  } else {
    const result = await safeExecute("INSERT INTO chats (user_id, title) VALUES (?, ?)", [
      userId,
      fallbackTitle(question),
    ]);
    chat = await findChatForUser(result.insertId, userId);
    isNewChat = true;
  }

  // 2. Load earlier messages of THIS chat as context (before saving the new one)
  const history = await getRecentMessages(chat.id);

  // 3. Save the question right away, so it's kept even if Gemini fails
  const userMessage = await createMessage({ chatId: chat.id, role: "user", content: question });
  await touchChat(chat.id);

  yield { type: "meta", data: { chat, isNewChat, userMessage } };

  // 4. Stream the answer from Gemini
  let answer = "";
  let totalTokens = 0;
  try {
    for await (const part of streamAnswer({ history, question, signal })) {
      if (signal?.aborted) break;
      if (part.text) {
        answer += part.text;
        yield { type: "delta", data: { text: part.text } };
      }
      if (part.totalTokens) totalTokens = part.totalTokens;
    }
  } catch (error) {
    // The user pressed "Stop": keep whatever was generated so far
    if (!signal?.aborted) {
      console.error("Gemini error:", error);
      throw toFriendlyError(error);
    }
  }

  if (!answer.trim()) {
    if (signal?.aborted) return;
    throw new BadGatewayError(
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
      const title = (await generateTitle(question)).slice(0, CHAT_TITLE_MAX);
      if (title) {
        await updateChatTitle(chat.id, userId, title);
        yield { type: "title", data: { chatId: chat.id, title } };
      }
    } catch (error) {
      console.warn("Could not generate chat title:", error.message);
    }
  }
}
