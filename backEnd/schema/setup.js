import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "./db.config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Splits schema.sql into single statements (comment lines removed)
export function readSchemaStatements(file = path.join(__dirname, "schema.sql")) {
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

// Creates any missing tables. Every statement uses CREATE TABLE IF NOT EXISTS,
// so this is safe to run every time the server starts.
export async function setupDatabase() {
  for (const statement of readSchemaStatements()) {
    await db.query(statement);
  }
}
