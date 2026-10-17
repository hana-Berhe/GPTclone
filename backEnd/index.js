// Must be the first import, so .env is loaded before the other files run
import "dotenv/config";
import { createApp } from "./src/app.js";
import { setupDatabase } from "./schema/setup.js";

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  try {
    // Creates any missing tables, and checks the database connection at the same time
    await setupDatabase();
    console.log("Connected to database");
  } catch (error) {
    console.error("Database connection failed. Server not started:", error.message);
    console.error("Run `npm run db:check` in the backEnd folder for details.");
    process.exit(1);
  }

  const app = createApp();
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    if (!app.locals.servesClient) {
      console.log("(No frontend build found: run the frontend with `npm run dev`.)");
    }
  });
}

// Stop right away with a clear message if a required setting is missing
const required = ["DB_HOST", "DB_USER", "DB_NAME", "JWT_SECRET", "GEMINI_API_KEY"];
const missing = required.filter((key) => !process.env[key]?.trim());
if (missing.length > 0) {
  console.error(`Missing in .env: ${missing.join(", ")}`);
  console.error("Copy backEnd/.env.example to backEnd/.env and fill them in.");
  process.exit(1);
}
if (process.env.JWT_SECRET.length < 32) {
  console.error("JWT_SECRET must be at least 32 characters long.");
  process.exit(1);
}

startServer();
