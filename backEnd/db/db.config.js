import mysql from "mysql2/promise";
import config from "../src/config/env.js";

const dbConnection = mysql.createPool({
  ...config.db,
  charset: "utf8mb4",
  // Work in UTC everywhere. Without this, dates shift by hours when the app and the
  // database are in different time zones (e.g. your computer and a cloud database).
  timezone: "Z",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Make MySQL's CURRENT_TIMESTAMP use UTC too, on every new connection in the pool.
dbConnection.pool.on("connection", (connection) => {
  connection.query("SET time_zone = '+00:00'", (error) => {
    if (error) console.error("Could not set the database time zone:", error.message);
  });
});

export default dbConnection;
