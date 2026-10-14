// Loaded with --import before any test file.
// 1. Provides the environment variables the app requires.
// 2. Swaps the MySQL pool and the Gemini client for in-memory fakes, so tests
//    run without a database server, an API key, or network access.
import { register } from "node:module";

// Every setting the app reads is set here, so your own backEnd/.env never affects the
// tests (dotenv does not overwrite variables that already exist).
Object.assign(process.env, {
  NODE_ENV: "test",
  PORT: "0",
  TRUST_PROXY: "0",
  CLIENT_ORIGIN: "http://localhost:5173",
  DB_HOST: "test",
  DB_PORT: "3306",
  DB_USER: "test",
  DB_PASSWORD: "test",
  DB_NAME: "test",
  DB_SSL: "false",
  DB_SSL_CA_FILE: "",
  DB_SSL_CA: "",
  JWT_SECRET: "test-secret-that-is-long-enough-for-the-config-check",
  JWT_EXPIRES_IN_DAYS: "7",
  GEMINI_API_KEY: "test",
  GEMINI_MODEL: "test-model",
  GEMINI_MAX_OUTPUT_TOKENS: "4096",
  // Most tests sign up and log in many times; production.test.js checks the real limits.
  RATE_LIMIT_AUTH_PER_15_MIN: "10000",
  RATE_LIMIT_MESSAGES_PER_MIN: "10000",
});

register("./hooks.js", import.meta.url);
