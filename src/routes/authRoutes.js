import { Router } from "express";
import { login, register } from "../controllers/userController.js";
import {  protect } from "../middlewares/authMiddleware.js";

const authRouter = Router();

authRouter.use("/register", register);
authRouter.use("/login", login);
authRouter.use("/getMe",protect, login);


export default authRouter;
