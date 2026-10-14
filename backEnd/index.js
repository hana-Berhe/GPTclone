import config from "./src/config/env.js";
import dbConnection from "./db/db.config.js";
import { createApp } from "./src/app.js";
import { setupDatabase } from "./db/setup.js";

const SHUTDOWN_TIMEOUT_MS = 10_000;

async function startServer() {
  try {
    await setupDatabase();
  } catch (error) {
    console.error("Could not set up the database:", error.message);
    console.error("Run `npm run db:check` in the backEnd folder for details.");
    process.exit(1);
  }

  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`Server is running on port ${config.port}`);
    if (!app.locals.servesClient) {
      console.log("(No frontend build found: run the frontend with `npm run dev`.)");
    }
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(`Port ${config.port} is already in use. Change PORT in .env.`);
    } else {
      console.error("Error starting the server:", error.message);
    }
    process.exit(1);
  });

  // Hosting platforms send SIGTERM before replacing the app with a new version.
  // Stop accepting new requests, let running ones finish, then close the database.
  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received: shutting down...`);

    setTimeout(() => {
      console.error("Shutdown took too long; exiting.");
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS).unref();

    server.close(async () => {
      await dbConnection.end().catch(() => {});
      console.log("Shutdown complete.");
      process.exit(0);
    });
    server.closeIdleConnections();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

startServer();
