import express from "express";
import auth from "../middlewares/auth.js";
import {
  getBuyerSummary,
  updateNotifications,
  updateProfile,
} from "../controllers/profileController.js";

const router = express.Router();

router.get("/summary", auth, getBuyerSummary);
router.put("/update", auth, updateProfile);
router.put("/notifications", auth, updateNotifications);

export default router;
