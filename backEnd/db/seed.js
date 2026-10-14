import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hashPassword } from "../src/lib/password.js";
import dbConnection from "./db.config.js";
import { setupDatabase } from "./setup.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_FILE = path.join(__dirname, "seed-data.md");

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const SECONDS_BETWEEN_MESSAGES = 50;

/**
 * Demo accounts. They all use @example.com, a domain reserved for examples, so seeding
 * never touches real users. `chats` limits a user to the first N chats of seed-data.md.
 */
export const DEMO_USERS = [
  { name: "Hana Berhe", email: "hana@example.com" },
  { name: "Abebe Kebede", email: "abebe@example.com", chats: 2 },
];

/**
 * Reads seed-data.md into [{ title, daysAgo, hoursAgo, messages: [{ role, content }] }].
 * @param {string} [text] File contents (defaults to seed-data.md).
 */
export function parseSeedChats(text = fs.readFileSync(SEED_FILE, "utf8")) {
  const withoutComments = text.replace(/<!--[\s\S]*?-->/g, "").replace(/\r\n/g, "\n");
  const chats = [];
  let currentMessage = null;

  for (const line of withoutComments.split("\n")) {
    const marker = line.match(/^@@@ (chat|user|assistant)\b(.*)$/);
    if (!marker) {
      if (currentMessage) currentMessage.lines.push(line);
      continue;
    }

    if (marker[1] === "chat") {
      const [title, daysAgo, hoursAgo] = marker[2]
        .split("|")
        .map((part) => part.trim())
        .filter(Boolean);
      chats.push({
        title,
        daysAgo: Number(daysAgo) || 0,
        hoursAgo: Number(hoursAgo) || 0,
        messages: [],
      });
      currentMessage = null;
    } else {
      const chat = chats.at(-1);
      if (!chat) throw new Error(`"@@@ ${marker[1]}" appears before the first "@@@ chat" line.`);
      currentMessage = { role: marker[1], lines: [] };
      chat.messages.push(currentMessage);
    }
  }

  return chats.map((chat) => {
    const messages = chat.messages.map(({ role, lines }) => ({
      role,
      content: lines.join("\n").trim(),
    }));
    if (messages[0]?.role !== "user") {
      throw new Error(`Chat "${chat.title}" must start with a user message.`);
    }
    return { ...chat, messages };
  });
}

// Creates the demo user, or resets the name and password if it already exists.
async function upsertUser({ name, email }, passwordHash) {
  const [rows] = await dbConnection.execute("SELECT id FROM users WHERE email = ? LIMIT 1", [email]);
  if (rows[0]) {
    const id = Number(rows[0].id);
    await dbConnection.execute("UPDATE users SET name = ?, password_hash = ? WHERE id = ?", [
      name,
      passwordHash,
      id,
    ]);
    return id;
  }
  const [result] = await dbConnection.execute(
    "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
    [name, email, passwordHash],
  );
  return Number(result.insertId);
}

/**
 * When a chat starts, so that it lands on the right calendar day (in this computer's
 * time zone) no matter what time the seed runs. "hoursAgo" counts back from the end of
 * that day, or from now for today. Near midnight, chats are kept inside their day,
 * in file order (earlier in the file = more recent).
 */
export function chatStartTime(chat, { now, positionInFile, chatCount }) {
  const today = new Date(now);
  const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - chat.daysAgo);
  const dayEnd = chat.daysAgo === 0 ? now : dayStart.getTime() + DAY;

  const duration = (chat.messages.length - 1) * SECONDS_BETWEEN_MESSAGES * 1000;
  const preferred = dayEnd - chat.hoursAgo * HOUR - duration - 60 * 1000;
  const earliest = dayStart.getTime() + (chatCount - positionInFile) * 60 * 1000;
  return Math.max(preferred, earliest);
}

async function insertChat(userId, chat, startTime) {
  const startedAt = new Date(startTime);
  const timeOf = (index) => new Date(startTime + index * SECONDS_BETWEEN_MESSAGES * 1000);
  const lastMessageAt = timeOf(chat.messages.length - 1);

  const [result] = await dbConnection.execute(
    "INSERT INTO chats (user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
    [userId, chat.title, startedAt, lastMessageAt],
  );
  const chatId = Number(result.insertId);

  let tokensSoFar = 0;
  for (const [index, message] of chat.messages.entries()) {
    // Roughly what the model would report: about 4 characters per token, whole conversation.
    tokensSoFar += Math.ceil(message.content.length / 4);
    await dbConnection.execute(
      `INSERT INTO messages (chat_id, role, content, token_count, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [chatId, message.role, message.content, message.role === "assistant" ? tokensSoFar : 0, timeOf(index)],
    );
  }
}

/**
 * Creates the demo users with their conversations. Safe to run again: each demo
 * user's old chats are replaced, and no other user is touched.
 *
 * @param {{ password: string, now?: number }} options
 * @returns {Promise<Array<{ name: string, email: string, chats: number, messages: number }>>}
 */
export async function seedDemoData({ password, now = Date.now() }) {
  await setupDatabase();

  const allChats = parseSeedChats();
  const passwordHash = await hashPassword(password);
  const summary = [];

  for (const user of DEMO_USERS) {
    const userId = await upsertUser(user, passwordHash);
    await dbConnection.execute("DELETE FROM chats WHERE user_id = ?", [userId]);

    const chats = user.chats ? allChats.slice(0, user.chats) : allChats;
    for (const [positionInFile, chat] of chats.entries()) {
      const startTime = chatStartTime(chat, { now, positionInFile, chatCount: chats.length });
      await insertChat(userId, chat, startTime);
    }

    summary.push({
      name: user.name,
      email: user.email,
      chats: chats.length,
      messages: chats.reduce((count, chat) => count + chat.messages.length, 0),
    });
  }

  return summary;
}
