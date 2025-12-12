// src/controllers/bidController.js
import mongoose from "mongoose";
import Auction from "../models/Auction.js";
import Bid from "../models/Bid.js";
import { sendMail } from "../utils/mailer.js";
import { getIO } from "../socket.js";

/**
 * placeBid - atomic with transaction
 * body: { auctionId, amount }
 */
export const placeBid = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    const { auctionId, amount } = req.body;
    if (!auctionId || amount == null)
      return res.status(400).json({ message: "auctionId and amount required" });
    if (!req.user || req.user.role !== "buyer")
      return res.status(403).json({ message: "Only buyers can place bids" });

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0)
      return res.status(400).json({ message: "Invalid bid amount" });

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
    if (new Date(auction.endAt) < now || auction.status === "closed") {
      await session.abortTransaction();
      return res
        .status(400)
        .json({ message: "Auction already ended or closed" });
    }

    // Fetch current highest / lowest depending on type (within session)
    let currentHighest = null;
    let currentLowest = null;

    if (auction.type === "reverse") {
      currentLowest = await Bid.findOne({ auction: auctionId })
        .sort({ amount: 1 })
        .session(session);
    } else {
      currentHighest = await Bid.findOne({ auction: auctionId })
        .sort({ amount: -1 })
        .session(session);
    }

    // Validation rules
    if (auction.type === "reverse") {
      const minInc = Number(auction.minIncrement || 1);
      const baseline = currentLowest
        ? Number(currentLowest.amount)
        : Number(auction.startPrice || 0);
      // new amount must be strictly lower by at least minInc OR equal if baseline is startPrice? We enforce <= baseline - minInc OR <= baseline if no previous? Use: if no previous allow <= startPrice
      if (currentLowest) {
        if (!(parsedAmount <= baseline - minInc)) {
          await session.abortTransaction();
          return res
            .status(400)
            .json({
              message: `Bid must be at least ₹${minInc} lower than current lowest (${baseline})`,
            });
        }
      } else {
        if (!(parsedAmount <= baseline)) {
          await session.abortTransaction();
          return res
            .status(400)
            .json({ message: `Initial reverse bid must be <= ₹${baseline}` });
        }
      }
    } else {
      const minInc = Number(auction.minIncrement || 1);
      const baseline = currentHighest
        ? Number(currentHighest.amount) + minInc
        : Number(auction.startPrice || 0);
      if (parsedAmount < baseline) {
        await session.abortTransaction();
        return res
          .status(400)
          .json({ message: `Bid must be at least ₹${baseline}` });
      }
    }

    // Track outbid user (only for traditional; sealed hides bidders)
    let outbidUser = null;
    if (
      currentHighest &&
      auction.type !== "sealed" &&
      currentHighest.bidder &&
      currentHighest.bidder.toString() !== req.user._id.toString()
    ) {
      outbidUser = currentHighest.bidder;
    }

    // Create bid
    const [created] = await Bid.create(
      [
        {
          auction: auctionId,
          bidder: req.user._id,
          amount: parsedAmount,
          sealed: auction.type === "sealed",
        },
      ],
      { session }
    );

    // Anti-sniping: only for traditional & sealed (not reverse)
    const ANTI_SNIPING_WINDOW_SEC = 30;
    let extended = false;
    const timeLeftSec = Math.floor((new Date(auction.endAt) - now) / 1000);
    if (
      (auction.type === "traditional" || auction.type === "sealed") &&
      timeLeftSec <= ANTI_SNIPING_WINDOW_SEC
    ) {
      auction.endAt = new Date(Date.now() + ANTI_SNIPING_WINDOW_SEC * 1000);
      await auction.save({ session });
      extended = true;
    }

    await session.commitTransaction();
    session.endSession();

    // Post-commit operations: emails, socket
    try {
      if (
        outbidUser &&
        outbidUser.email &&
        outbidUser.notificationSettings?.newBid !== false
      ) {
        const html = `<h3>Hello ${outbidUser.name}</h3><p>You were outbid on ${auction.product?.title}</p><p>Current: ₹${parsedAmount}</p><p><a href="${process.env.FRONTEND_URL}/auction/${auctionId}">Place higher bid</a></p>`;
        await sendMail(outbidUser.email, "You've been outbid", html);
      }
    } catch (emailErr) {
      console.error("Outbid email failed:", emailErr.message);
    }

    // socket event
    try {
      const io = getIO();
      if (io) {
        io.to(`auction:${auctionId}`).emit("newBid", {
          auctionId,
          bid: {
            _id: created._id,
            amount: created.amount,
            bidder: { id: req.user._id, name: req.user.name },
            createdAt: created.createdAt,
          },
          extended,
        });
      }
    } catch (emitErr) {
      console.error("Socket emit error:", emitErr.message);
    }

    return res.status(201).json({ message: "Bid placed", bid: created });
  } catch (err) {
    try {
      await session.abortTransaction();
    } catch {}
    session.endSession();
    next(err);
  }
};

/**
 * getBidsForAuction
 * - auth required in your router (you used auth)
 * - sealed auctions hide bids if not closed
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
    return res.json(bids);
  } catch (err) {
    next(err);
  }
};

/**
 * getBuyerSummary - simple metrics
 */
export const getBuyerSummary = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const totalBids = await Bid.countDocuments({ bidder: userId });

    // wonAuctions: count auctions where winnerBid exists and that winnerBid belongs to this user
    const auctionsWithWinner = await Auction.find({
      status: "closed",
      winnerBid: { $exists: true },
    }).select("_id winnerBid");
    let wonAuctions = 0;
    for (const a of auctionsWithWinner) {
      if (!a.winnerBid) continue;
      const winnerBid = await Bid.findById(a.winnerBid);
      if (
        winnerBid &&
        winnerBid.bidder &&
        winnerBid.bidder.toString() === userId.toString()
      )
        wonAuctions++;
    }

    const activeBids = await Bid.countDocuments({
      bidder: userId,
      createdAt: { $gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 365) },
    }); // simple metric

    return res.json({ totalBids, wonAuctions, activeBids });
  } catch (err) {
    next(err);
  }
};
