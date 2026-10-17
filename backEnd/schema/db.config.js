import mysql from "mysql2/promise";
import { buildDbSslOptions } from "../src/utility/dbSsl.js";

export const dbOptions = {
  host: process.env.DB_HOST,
  // Cloud databases (Aiven) use their own port. Locally: 3306.
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME,
  charset: "utf8mb4",
  // Work in UTC everywhere, so dates don't shift between my computer and the cloud database
  timezone: "Z",
  ssl: buildDbSslOptions(process.env),
};

const db = mysql.createPool({ ...dbOptions, connectionLimit: 10 });

// Make MySQL's CURRENT_TIMESTAMP use UTC too, on every new connection
db.pool.on("connection", (connection) => {
  connection.query("SET time_zone = '+00:00'", (error) => {
    if (error) console.error("Could not set the database time zone:", error.message);
  });
});

// Every query goes through here with ? placeholders, so values are always escaped
const safeExecute = async (sql, params) => {
  if (!Array.isArray(params)) {
    throw new Error("SQL parameters must be an array");
  }
  const [result] = await db.execute(sql, params);
  return result;
};

export { db, safeExecute };
