import { StatusCodes } from "http-status-codes";
import {
  registerService,
  loginService,
  getCurrentUserService,
} from "../service/auth.service.js";

// req.validated holds only the checked and cleaned fields (see validation-handler.js)

const registerController = async (req, res, next) => {
  try {
    const { name, email, password } = req.validated;
    const result = await registerService({ name, email, password });

    res.status(StatusCodes.CREATED).json({
      status: "success",
      message: "Account created.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const loginController = async (req, res, next) => {
  try {
    const { email, password } = req.validated;
    const result = await loginService({ email, password });

    res.status(StatusCodes.OK).json({
      status: "success",
      message: "Logged in.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const meController = async (req, res, next) => {
  try {
    const user = await getCurrentUserService(req.user.id);
    res.status(StatusCodes.OK).json({ status: "success", data: { user } });
  } catch (error) {
    next(error);
  }
};

export { registerController, loginController, meController };
