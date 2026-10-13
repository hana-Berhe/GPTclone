import config from "./src/config/env.js";
import { createApp } from "./src/app.js";
import { setupDatabase } from "./db/setup.js";

async function startServer() {
  try {
    await setupDatabase();
  } catch (error) {
    console.error("Could not set up the database:", error.message);
    console.error("Check the DB_* environment variables.");
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
}

startServer();
