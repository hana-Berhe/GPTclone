import express from "express";
import {
  registerController,
  loginController,
  meController,
} from "../controller/auth.controller.js";
import { registerValidation, loginValidation } from "../validations/auth.validation.js";
import { loginRateLimit, registerRateLimit } from "../../../middleware/auth-rate-limit.js";
import { authenticateUser } from "../../../middleware/authentication.js";

const authRouter = express.Router();

/**
 * @route POST /api/auth/register
 * @desc Create an account, returns the user and a token
 * @access Public
 */
authRouter.post("/register", registerRateLimit, registerValidation, registerController);

/**
 * @route POST /api/auth/login
 * @desc Check email and password, returns the user and a token
 * @access Public
 */
authRouter.post("/login", loginRateLimit, loginValidation, loginController);

/**
 * @route GET /api/auth/me
 * @desc Return the logged-in user
 * @access Protected
 */
authRouter.get("/me", authenticateUser, meController);

export { authRouter };
