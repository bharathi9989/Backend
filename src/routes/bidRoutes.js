import { Router } from "express";
import auth from "../middlewares/auth.js";
import { getBidsForAuction, placeBid } from "../controllers/bidController.js";



const bidRoutes = Router();

// Place new bid (buyer)
bidRoutes.post("/", auth, placeBid)


// Get all bids for specific auction
bidRoutes.get("/:auctionId", auth, getBidsForAuction)

export default bidRoutes;