import { getCurrentUserService, loginService, registerService } from "../service/auth.service.js";

// Input is already validated and cleaned by the validate() middleware (req.validated).
// Express 5 forwards rejected promises to the error handler, so no try/catch is needed.

export async function registerController(req, res) {
  const result = await registerService(req.validated);
  res.status(201).json({ status: "success", message: "Account created.", data: result });
}

export async function loginController(req, res) {
  const result = await loginService(req.validated);
  res.status(200).json({ status: "success", message: "Logged in.", data: result });
}

export async function meController(req, res) {
  const user = await getCurrentUserService(req.userId);
  res.status(200).json({ status: "success", data: { user } });
}
