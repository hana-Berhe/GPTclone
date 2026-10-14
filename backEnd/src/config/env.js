import "dotenv/config";

// Fail fast with a clear message instead of crashing later in a request.
const required = ["DB_HOST", "DB_USER", "DB_NAME", "JWT_SECRET", "GEMINI_API_KEY"];
const missing = required.filter((key) => !process.env[key]?.trim());

if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(", ")}`);
  console.error("Copy backEnd/.env.example to backEnd/.env and fill them in.");
  process.exit(1);
}

if (process.env.JWT_SECRET.length < 32) {
  console.error("JWT_SECRET must be at least 32 characters long.");
  process.exit(1);
}

const useDbSsl = process.env.DB_SSL?.trim().toLowerCase() === "true";
// Hosting dashboards often store multi-line values with literal "\n"; turn them back into newlines.
const dbSslCa = process.env.DB_SSL_CA?.replace(/\\n/g, "\n").trim();

if (useDbSsl && !dbSslCa?.includes("BEGIN CERTIFICATE")) {
  console.error("DB_SSL is true, so DB_SSL_CA must contain the database's CA certificate.");
  console.error("Paste the whole certificate, including the BEGIN/END CERTIFICATE lines.");
  process.exit(1);
}

const toInt = (value, fallback) => {
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) || n <= 0 ? fallback : n;
};

const config = {
  port: toInt(process.env.PORT, 3000),
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
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash-lite",
    maxOutputTokens: toInt(process.env.GEMINI_MAX_OUTPUT_TOKENS, 4096),
  },
};

export default config;
