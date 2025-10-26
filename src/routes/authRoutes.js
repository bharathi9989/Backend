import { Router } from "express";
import { loginUser, registerUser } from "../controllers/userController.js";

const authRoutes = Router();

/**
 * @desc Register a new user
 * @route POST /api/auth/register
 * @access Public
 */

authRoutes.post("/register", registerUser);

authRoutes.get("/login", loginUser);

export default authRoutes;
