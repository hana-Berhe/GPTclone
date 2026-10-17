// Checks the database settings in .env and explains what's wrong if it can't connect.
// Usage (in the backEnd folder): npm run db:check
import "dotenv/config";
import crypto from "node:crypto";
import mysql from "mysql2/promise";
import { db, dbOptions } from "../schema/db.config.js";

const { host, port, user, database, ssl } = dbOptions;

console.log("Database settings");
console.log(`  Host:      ${host}:${port}`);
console.log(`  User:      ${user}`);
console.log(`  Database:  ${database}`);
console.log(`  SSL:       ${ssl ? "on" : "off"}`);

if (ssl) {
  const certificate = new crypto.X509Certificate(ssl.ca);
  const subject = certificate.subject.replace(/\n/g, ", ");
  console.log(`  CA cert:   ${subject}`);
  console.log(`  Valid to:  ${certificate.validTo}`);
  if (new Date(certificate.validTo) < new Date()) console.log("  ! This certificate has expired.");
}

const HINTS = {
  certificate: [
    "The CA certificate doesn't belong to this database server.",
    "In Aiven, open THIS service's Overview page, download 'CA certificate' again,",
    "and use that file. The 'CA cert' line above should mention 'Project CA'.",
  ],
  ER_ACCESS_DENIED_ERROR: ["Wrong user or password. Copy them again from the provider's dashboard."],
  ER_BAD_DB_ERROR: [
    `The database "${database}" doesn't exist on this server.`,
    "Create it (Aiven: service > Databases > Create database) or fix DB_NAME.",
  ],
  ENOTFOUND: ["The host name can't be found. Check DB_HOST for typos."],
  ETIMEDOUT: [
    "No answer from the server. Check DB_HOST and DB_PORT (Aiven doesn't use 3306),",
    "and that the provider's 'Allowed IP addresses' includes your IP (or 0.0.0.0/0).",
  ],
  ECONNREFUSED: ["The server refused the connection. Check DB_HOST and DB_PORT."],
  sslRequired: ["This server requires an encrypted connection: set DB_SSL=true."],
};

function hintFor(error) {
  if (/certificate|self[- ]signed|unable to (get|verify)/i.test(error.message)) {
    return HINTS.certificate;
  }
  if (/secure transport|require_secure|SSL connection is required/i.test(error.message)) {
    return HINTS.sslRequired;
  }
  return HINTS[error.code] ?? ["Check the DB_* values in .env."];
}

let connection;
try {
  connection = await mysql.createConnection({ ...dbOptions, connectTimeout: 10000 });
  const [[server]] = await connection.query("SELECT VERSION() AS version");
  const [tables] = await connection.query("SHOW TABLES");
  const names = tables.map((row) => Object.values(row)[0]);

  console.log(`\n✓ Connected to MySQL ${server.version}`);
  console.log(
    names.length
      ? `  Tables: ${names.join(", ")}`
      : "  No tables yet: the app creates them the first time it starts.",
  );
  process.exitCode = 0;
} catch (error) {
  console.error(`\n✗ Could not connect: ${error.message}`);
  for (const line of hintFor(error)) console.error(`  ${line}`);
  process.exitCode = 1;
} finally {
  await connection?.end().catch(() => {});
  await db.end().catch(() => {});
}
