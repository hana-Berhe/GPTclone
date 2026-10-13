import mysql from "mysql2/promise";
import config from "../src/config/env.js";

const dbConnection = mysql.createPool({
  ...config.db,
  charset: "utf8mb4",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export default dbConnection;
