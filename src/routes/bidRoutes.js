import express from "express";
import auth from "../middlewares/auth.js";
import { placeBid, getBidsForAuction } from "../controllers/bidController.js";

const router = express.Router();

router.post("/", auth, placeBid);
router.get("/:auctionId", auth, getBidsForAuction);

export default router;
