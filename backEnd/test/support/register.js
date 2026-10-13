// Loaded with --import before any test file.
// 1. Provides the environment variables the app requires.
// 2. Swaps the MySQL pool and the Gemini client for in-memory fakes, so tests
//    run without a database server, an API key, or network access.
import { register } from "node:module";

Object.assign(process.env, {
  DB_HOST: "test",
  DB_USER: "test",
  DB_NAME: "test",
  JWT_SECRET: "test-secret-that-is-long-enough-for-the-config-check",
  GEMINI_API_KEY: "test",
});

register("./hooks.js", import.meta.url);
