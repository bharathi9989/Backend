import express from "express";
import {
  registerUser,
  loginUser,
  me,
 
} from "../controllers/userController.js";
import auth from "../middlewares/auth.js";

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/me", auth, me);

export default router;
