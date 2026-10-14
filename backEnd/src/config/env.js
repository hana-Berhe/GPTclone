import "dotenv/config";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function fail(...lines) {
  for (const line of lines) console.error(line);
  process.exit(1);
}

// Fail fast with a clear message instead of crashing later in a request.
const required = ["DB_HOST", "DB_USER", "DB_NAME", "JWT_SECRET", "GEMINI_API_KEY"];
const missing = required.filter((key) => !process.env[key]?.trim());

if (missing.length) {
  fail(
    `Missing required environment variables: ${missing.join(", ")}`,
    "Copy backEnd/.env.example to backEnd/.env and fill them in.",
  );
}

if (process.env.JWT_SECRET.length < 32) fail("JWT_SECRET must be at least 32 characters long.");

const useDbSsl = process.env.DB_SSL?.trim().toLowerCase() === "true";

// The backEnd folder, so relative paths like ./ca.pem work from any working directory.
const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

// The CA certificate can come from a file (DB_SSL_CA_FILE, easiest) or from text (DB_SSL_CA).
function readDbCaCertificate() {
  const file = process.env.DB_SSL_CA_FILE?.trim();
  if (file) {
    const fullPath = path.resolve(backendRoot, file);
    try {
      return fs.readFileSync(fullPath, "utf8");
    } catch {
      fail(`DB_SSL_CA_FILE points to ${fullPath}, but that file can't be read.`);
    }
  }
  // Dashboards often store multi-line values with literal "\n"; turn them back into newlines.
  return process.env.DB_SSL_CA?.replace(/\\n/g, "\n");
}

let dbSslCa;
if (useDbSsl) {
  dbSslCa = readDbCaCertificate()?.replace(/\r\n/g, "\n").trim();

  if (!dbSslCa?.includes("BEGIN CERTIFICATE")) {
    fail(
      "DB_SSL is true, so the database's CA certificate is required.",
      "Set DB_SSL_CA_FILE to the downloaded file (e.g. ./ca.pem) or paste it into DB_SSL_CA.",
    );
  }
  try {
    new crypto.X509Certificate(dbSslCa);
  } catch {
    fail(
      "The database CA certificate is damaged (it couldn't be read as a certificate).",
      "Download it again, or check that every line was pasted without extra spaces.",
    );
  }
}

const toInt = (value, fallback) => {
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) || n <= 0 ? fallback : n;
};

const config = {
  isProduction: process.env.NODE_ENV === "production",
  port: toInt(process.env.PORT, 3000),
  // Number of proxies in front of the app (Render/Railway: 1). Needed to see the visitor's real
  // IP address for rate limiting. Leave at 0 locally, where there is no proxy.
  trustProxy: toInt(process.env.TRUST_PROXY, 0),
  clientOrigins: (process.env.CLIENT_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  db: {
    host: process.env.DB_HOST,
    port: toInt(process.env.DB_PORT, 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME,
    // Encrypted connection with certificate verification (required by Aiven and most cloud databases)
    ssl: useDbSsl ? { ca: dbSslCa, rejectUnauthorized: true } : undefined,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresInDays: toInt(process.env.JWT_EXPIRES_IN_DAYS, 7),
  },
  // Requests allowed per visitor, to stop password guessing and protect the Gemini quota.
  rateLimit: {
    authPer15Min: toInt(process.env.RATE_LIMIT_AUTH_PER_15_MIN, 20),
    messagesPerMin: toInt(process.env.RATE_LIMIT_MESSAGES_PER_MIN, 15),
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash-lite",
    maxOutputTokens: toInt(process.env.GEMINI_MAX_OUTPUT_TOKENS, 4096),
  },
};

export default config;
