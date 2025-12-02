import mongoose from "mongoose";
import Auction from "../models/Auction.js";
import Bid from "../models/Bid.js";
import { getIO } from "../socket.js";

/**
 * Place bid - atomic using transaction
 * body: { auctionId, amount }
 */
export const placeBid = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    const { auctionId, amount } = req.body;
    if (!auctionId || amount == null)
      return res.status(400).json({ message: "auctionId and amount required" });

    if (req.user.role !== "buyer")
      return res.status(403).json({ message: "Only buyers can place bids" });

    session.startTransaction();

    const auction = await Auction.findById(auctionId)
      .session(session)
      .populate("product");
    if (!auction) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Auction not found" });
    }

    const now = new Date();
    if (new Date(auction.startAt) > now) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Auction not started yet" });
    }
    if (new Date(auction.endAt) < now) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Auction already ended" });
    }
    if (auction.status === "closed") {
      await session.abortTransaction();
      return res.status(400).json({ message: "Auction closed" });
    }

    // compute current price depending on type
    let minRequiredBid = auction.startPrice;
    // get current top bid(s)
    const highestBid = await Bid.findOne({ auction: auctionId })
      .sort({ amount: -1 })
      .session(session);
    const lowestBid =
      auction.type === "reverse"
        ? await Bid.findOne({ auction: auctionId })
            .sort({ amount: 1 })
            .session(session)
        : null;

    if (highestBid) {
      if (auction.type === "reverse") {
        // must be lower than current lowest by at least minIncrement
        const currentLowest = lowestBid ? lowestBid.amount : auction.startPrice;
        if (
          !(
            amount < currentLowest &&
            currentLowest - amount >= auction.minIncrement
          )
        ) {
          await session.abortTransaction();
          return res
            .status(400)
            .json({
              message: `Bid must be at least ${auction.minIncrement} lower than current lowest (${currentLowest})`,
            });
        }
      } else {
        // traditional/sealed: must be >= highest + minIncrement
        minRequiredBid = highestBid.amount + auction.minIncrement;
        if (amount < minRequiredBid) {
          await session.abortTransaction();
          return res
            .status(400)
            .json({ message: `Bid must be at least ${minRequiredBid}` });
        }
      }
    } else {
      // no bids yet
      if (auction.type === "reverse") {
        if (!(amount <= auction.startPrice)) {
          await session.abortTransaction();
          return res
            .status(400)
            .json({
              message: `Initial reverse bid must be <= startPrice (${auction.startPrice})`,
            });
        }
      } else {
        if (amount < auction.startPrice) {
          await session.abortTransaction();
          return res
            .status(400)
            .json({
              message: `Initial bid must be >= startPrice (${auction.startPrice})`,
            });
        }
      }
    }

    // Create bid
    const bid = await Bid.create(
      [
        {
          auction: auctionId,
          bidder: req.user._id,
          amount,
          sealed: auction.type === "sealed",
        },
      ],
      { session }
    );

    // anti-sniping: if bid within last N seconds extend endAt (business rule)
    const ANTI_SNIPING_WINDOW_SEC = 30;
    const timeLeftSec = Math.floor((new Date(auction.endAt) - now) / 1000);
    let extended = false;
    if (timeLeftSec <= ANTI_SNIPING_WINDOW_SEC) {
      auction.endAt = new Date(Date.now() + ANTI_SNIPING_WINDOW_SEC * 1000);
      await auction.save({ session });
      extended = true;
    }

    await session.commitTransaction();
    session.endSession();

    // After commit: emit socket event
    try {
      const io = getIO();
      io.to(`auction:${auctionId}`).emit("newBid", {
        auctionId,
        amount,
        bidder: { id: req.user._id, name: req.user.name },
        time: new Date(),
        sealed: auction.type === "sealed",
        extended,
      });
    } catch (emitErr) {
      console.error("Socket emit error:", emitErr.message);
    }

    res.status(201).json({ message: "Bid placed", bid: bid[0] });
  } catch (err) {
    await session.abortTransaction().catch(() => {});
    session.endSession();
    next(err);
  }
};

/**
 * Get bids for auction
 */
export const getBidsForAuction = async (req, res, next) => {
  try {
    const auctionId = req.params.auctionId;
    const auction = await Auction.findById(auctionId);
    if (!auction) return res.status(404).json({ message: "Auction not found" });

    if (auction.type === "sealed" && auction.status !== "closed") {
      return res
        .status(403)
        .json({ message: "Bids are sealed until auction ends" });
    }

    const bids = await Bid.find({ auction: auctionId })
      .populate("bidder", "name email")
      .sort({ amount: -1 });
    res.json(bids);
  } catch (err) {
    next(err);
  }
};
