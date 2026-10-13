import express from "express";
import { requireAuth } from "../../../middleware/auth.js";
import { validate } from "../../../middleware/validate.js";
import {
  loginController,
  meController,
  registerController,
} from "../controller/auth.controller.js";
import { loginRules, registerRules } from "../validation/auth.validation.js";

const authRouter = express.Router();

// /api/auth/...
authRouter.post("/register", validate(registerRules), registerController);
authRouter.post("/login", validate(loginRules), loginController);
authRouter.get("/me", requireAuth, meController);

export default authRouter;
