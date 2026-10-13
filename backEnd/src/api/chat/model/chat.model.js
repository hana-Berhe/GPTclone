import dbConnection from "../../../../db/db.config.js";

// Shape DB rows into the camelCase structure the frontend expects.
const toChat = (row) =>
  row && {
    id: Number(row.id),
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

const toMessage = (row) =>
  row && {
    id: Number(row.id),
    chatId: Number(row.chat_id),
    role: row.role,
    content: row.content,
    tokenCount: Number(row.token_count || 0),
    createdAt: row.created_at,
  };

const MESSAGE_COLUMNS = "id, chat_id, role, content, token_count, created_at";

// ---- chats ----

export const listChatsByUser = async (userId) => {
  const [rows] = await dbConnection.execute(
    `SELECT id, title, created_at, updated_at
     FROM chats
     WHERE user_id = ?
     ORDER BY updated_at DESC, id DESC`,
    [userId],
  );
  return rows.map(toChat);
};

export const findChatForUser = async (chatId, userId) => {
  const [rows] = await dbConnection.execute(
    `SELECT id, title, created_at, updated_at
     FROM chats
     WHERE id = ? AND user_id = ?
     LIMIT 1`,
    [chatId, userId],
  );
  return toChat(rows[0]) || null;
};

export const createChat = async (userId, title) => {
  const [result] = await dbConnection.execute(`INSERT INTO chats (user_id, title) VALUES (?, ?)`, [
    userId,
    title,
  ]);
  return findChatForUser(result.insertId, userId);
};

export const updateChatTitle = async (chatId, userId, title) => {
  const [result] = await dbConnection.execute(
    `UPDATE chats SET title = ? WHERE id = ? AND user_id = ?`,
    [title, chatId, userId],
  );
  return result.affectedRows > 0;
};

export const touchChat = async (chatId) => {
  await dbConnection.execute(`UPDATE chats SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [
    chatId,
  ]);
};

export const deleteChat = async (chatId, userId) => {
  // Messages are removed by ON DELETE CASCADE.
  const [result] = await dbConnection.execute(`DELETE FROM chats WHERE id = ? AND user_id = ?`, [
    chatId,
    userId,
  ]);
  return result.affectedRows > 0;
};

// ---- messages ----

export const getMessagesByChat = async (chatId) => {
  const [rows] = await dbConnection.execute(
    `SELECT ${MESSAGE_COLUMNS}
     FROM messages
     WHERE chat_id = ?
     ORDER BY id ASC`,
    [chatId],
  );
  return rows.map(toMessage);
};

export const getRecentMessages = async (chatId, limit) => {
  // LIMIT can't be a placeholder with mysql2's execute(), so it is validated and inlined.
  const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : 20;
  const [rows] = await dbConnection.execute(
    `SELECT ${MESSAGE_COLUMNS}
     FROM messages
     WHERE chat_id = ?
     ORDER BY id DESC
     LIMIT ${safeLimit}`,
    [chatId],
  );
  return rows.reverse().map(toMessage);
};

export const getMessageById = async (messageId) => {
  const [rows] = await dbConnection.execute(
    `SELECT ${MESSAGE_COLUMNS} FROM messages WHERE id = ? LIMIT 1`,
    [messageId],
  );
  return toMessage(rows[0]) || null;
};

export const createMessage = async ({ chatId, role, content, tokenCount = 0 }) => {
  const [result] = await dbConnection.execute(
    `INSERT INTO messages (chat_id, role, content, token_count)
     VALUES (?, ?, ?, ?)`,
    [chatId, role, content, tokenCount],
  );
  return getMessageById(result.insertId);
};
