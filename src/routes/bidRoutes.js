import express from "express";
import auth from "../middlewares/auth.js";
import { placeBid, getBidsForAuction, getBuyerSummary } from "../controllers/bidController.js";
import { getMyBids } from "../controllers/bidHistoryController.js";

const router = express.Router();

router.post("/", auth, placeBid);

router.get("/my", auth, getMyBids);
router.get("/summary", auth, getBuyerSummary);

router.get("/:auctionId", auth, getBidsForAuction);





export default router;
