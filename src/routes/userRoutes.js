import express from "express";

import { updateNotificationSettings } from "../controllers/userController.js";
import auth from "../middlewares/auth.js";

const router = express.Router();

// 🔥 This is the missing route causing your 404 error
router.put("/settings/notifications", auth, updateNotificationSettings);

export default router;
