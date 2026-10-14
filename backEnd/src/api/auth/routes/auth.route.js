import express from "express";
import config from "../../../config/env.js";
import { requireAuth } from "../../../middleware/auth.js";
import { rateLimit } from "../../../middleware/rate-limit.js";
import { validate } from "../../../middleware/validate.js";
import {
  loginController,
  meController,
  registerController,
} from "../controller/auth.controller.js";
import { loginRules, registerRules } from "../validation/auth.validation.js";

const authRouter = express.Router();

// Slows down password guessing and mass sign-ups from one IP address.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.rateLimit.authPer15Min,
  message: "Too many attempts. Please wait a few minutes and try again.",
});

// /api/auth/...
authRouter.post("/register", authLimiter, validate(registerRules), registerController);
authRouter.post("/login", authLimiter, validate(loginRules), loginController);
authRouter.get("/me", requireAuth, meController);

export default authRouter;
