// src/routes/auctionRoutes.js
import express from "express";
import auth from "../middlewares/auth.js";
import {
  closeAuctionNow,
  createAuction,
  getAllAuctions,
  getAuctionById,
  relistProduct,
  updateAuctionStatus,
} from "../controllers/auctionController.js";

const router = express.Router();

/**
 * Public: Anyone can list auctions or view an auction detail.
 * - GET /          -> list auctions (public)
 * - GET /:id       -> auction details (public)
 *
 * Protected:
 * - POST /         -> create auction (seller only)
 * - PUT /:id/status-> update auction status (seller only)
 */
router.get("/", (req, res, next) => {
  // If user requests seller-only auctions (my=true), enforce auth
  if (req.query.my === "true") {
    return auth(req, res, () => getAllAuctions(req, res, next));
  }
  return getAllAuctions(req, res, next);
}); // public


// router.post("/", auth, createAuction); // protected (seller)
router.put("/:id/status", auth, updateAuctionStatus); // protected (seller)
router.put("/:id/close", auth, closeAuctionNow);
router.post("/relist", auth, relistProduct);


router.get("/:id", getAuctionById); // public


export default router;
