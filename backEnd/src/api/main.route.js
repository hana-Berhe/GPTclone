import express from "express";
import authRouter from "./auth/routes/auth.route.js";
import chatRouter from "./chat/routes/chat.route.js";

const mainRouter = express.Router();

mainRouter.get("/health", (req, res) => res.json({ status: "ok" }));

// /api/auth
mainRouter.use("/auth", authRouter);
// /api/chats
mainRouter.use("/chats", chatRouter);

export default mainRouter;
