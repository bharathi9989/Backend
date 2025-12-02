import express from "express";
import auth from "../middlewares/auth.js";
import {
  createAuction,
  getAllAuctions,
  getAuctionById,
  updateAuctionStatus,
} from "../controllers/auctionController.js";

const router = express.Router();

router.post("/", auth, createAuction);
router.get("/", getAllAuctions);
router.get("/:id", getAuctionById);
router.put("/:id/status", auth, updateAuctionStatus);

export default router;
