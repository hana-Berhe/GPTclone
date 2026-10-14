import config from "./config/env.js";
import express from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mainRouter from "./api/main.route.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { securityHeaders } from "./middleware/security-headers.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Builds the Express app without starting it, so tests can use it directly.
export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  // Behind a hosting proxy (e.g. Render), read the visitor's real IP from X-Forwarded-For.
  app.set("trust proxy", config.trustProxy);

  app.use(securityHeaders({ isProduction: config.isProduction }));
  app.use(cors({ origin: config.clientOrigins }));
  app.use(express.json({ limit: "1mb" }));

  app.use("/api", mainRouter);

  // In production the React build (frontend/dist) is served by this same server,
  // so the website and the API share one address. In development Vite serves it instead.
  const clientDist = path.resolve(__dirname, "../../frontend/dist");
  const clientIndex = path.join(clientDist, "index.html");

  if (fs.existsSync(clientIndex)) {
    // Built files have a hash in their name, so browsers can cache them for a long time.
    app.use(
      "/assets",
      express.static(path.join(clientDist, "assets"), { immutable: true, maxAge: "1y" }),
    );
    app.use(express.static(clientDist, { index: false }));
    // Any other page (/, /c/12, ...) loads the React app, which handles the route.
    app.use((req, res, next) => {
      const isPageRequest = req.method === "GET" || req.method === "HEAD";
      if (!isPageRequest || req.path.startsWith("/api")) return next();
      // Never cache index.html, so visitors get the newest version right after a deploy.
      res.sendFile(clientIndex, { headers: { "Cache-Control": "no-cache" } });
    });
    app.locals.servesClient = true;
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
