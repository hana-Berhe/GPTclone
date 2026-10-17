import express from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mainRouter } from "./mainRoutes.js";
import { errorHandler, notFound } from "./middleware/error-handler.js";
import { securityHeaders } from "./middleware/security-headers.js";
import { parseCorsOrigins } from "./utility/corsOrigins.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Builds the Express app without starting it, so the tests can use it too
export function createApp() {
  const app = express();
  app.disable("x-powered-by");

  // Render runs the app behind one proxy (TRUST_PROXY=1). This makes req.ip the
  // visitor's real IP, which the login rate limit depends on. Locally: 0.
  app.set("trust proxy", Number(process.env.TRUST_PROXY) || 0);

  // middleware
  app.use(securityHeaders({ isProduction: process.env.NODE_ENV === "production" }));
  app.use(cors({ origin: parseCorsOrigins(process.env.CLIENT_ORIGIN || "http://localhost:5173") }));
  app.use(express.json({ limit: "1mb" }));

  // Main api
  app.use("/api", mainRouter);

  // In production this server also serves the React build (frontend/dist), so the
  // website and the API share one address. In development, Vite serves it instead.
  const clientDist = path.resolve(__dirname, "../../frontend/dist");
  const clientIndex = path.join(clientDist, "index.html");

  if (fs.existsSync(clientIndex)) {
    // Built files have a hash in their name, so browsers can cache them for a long time
    app.use(
      "/assets",
      express.static(path.join(clientDist, "assets"), { immutable: true, maxAge: "1y" }),
    );
    app.use(express.static(clientDist, { index: false }));
    // Any other page (/, /c/12, ...) loads the React app, which handles the route
    app.use((req, res, next) => {
      const isPageRequest = req.method === "GET" || req.method === "HEAD";
      if (!isPageRequest || req.path.startsWith("/api")) return next();
      // Never cache index.html, so visitors get the newest version right after a deploy
      res.sendFile(clientIndex, { headers: { "Cache-Control": "no-cache" } });
    });
    app.locals.servesClient = true;
  }

  // error handler middleware should be after all api calls
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
