import {
  createAuction,
  getAllAuctions,
  getAuctionById,
  updateAuctionStatus,
} from "../controllers/auctionController.js";
import { Router } from "express";
import auth from "../middlewares/auth.js";

const auctionRoutes = Router();

auctionRoutes.post("/", auth, createAuction);

auctionRoutes.get("/", getAllAuctions);

auctionRoutes.get("/:id", getAuctionById);

auctionRoutes.put("/:id/status", auth, updateAuctionStatus);

export default auctionRoutes;
