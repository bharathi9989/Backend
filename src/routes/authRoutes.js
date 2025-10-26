import { Router } from "express";
import { loginUser, registerUser } from "../controllers/userController.js";
import { protect } from "../middlewares/authMiddleware.js";

const authRouter = Router();

/**
 * @desc Register a new user
 * @route POST /api/auth/register
 * @access Public
 */

authRouter.post("/register", registerUser);

authRouter.get("/login", loginUser);

export default authRouter;
