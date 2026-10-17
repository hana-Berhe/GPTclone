// In-memory SQLite database that mimics the parts of the mysql2 pool the app uses.
import { DatabaseSync } from "node:sqlite";

const sqlite = new DatabaseSync(":memory:");

sqlite.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE chats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'New chat',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER NOT NULL REFERENCES chats (id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    token_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

// MySQL stores dates as "YYYY-MM-DD HH:MM:SS" (UTC in this app); SQLite needs plain values.
const toSqlValue = (value) =>
  value instanceof Date ? value.toISOString().slice(0, 19).replace("T", " ") : value;

async function run(sql, params = []) {
  // The tables above already exist; schema/setup.js's MySQL statements are not needed.
  if (/^\s*CREATE TABLE IF NOT EXISTS/i.test(sql)) return [{}];

  const statement = sqlite.prepare(sql);
  try {
    const values = params.map(toSqlValue);
    if (/^\s*select/i.test(sql)) return [statement.all(...values)];
    const result = statement.run(...values);
    return [{ insertId: Number(result.lastInsertRowid), affectedRows: Number(result.changes) }];
  } catch (error) {
    if (/UNIQUE/.test(error.message)) error.code = "ER_DUP_ENTRY";
    throw error;
  }
}

// Same exports as schema/db.config.js
export const db = { execute: run, query: run, end: async () => {} };
export const dbOptions = {};
export const safeExecute = async (sql, params) => (await run(sql, params))[0];
