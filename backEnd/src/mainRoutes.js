import express from "express";
import { authRouter } from "./api/auth/routes/auth.routes.js";
import { chatRouter } from "./api/chat/routes/chat.routes.js";

export const mainRouter = express.Router();

// Render checks this to know the server is up
mainRouter.get("/health", (req, res) => res.json({ status: "ok" }));

mainRouter.use("/auth", authRouter);
mainRouter.use("/chats", chatRouter);
