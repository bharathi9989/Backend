// src/controllers/bidController.js
import mongoose from "mongoose";
import Auction from "../models/Auction.js";
import Bid from "../models/Bid.js";
import User from "../models/User.js";
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

    // load auction inside session
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
      return res.status(400).json({ message: "Auction has not started yet" });
    }
    if (new Date(auction.endAt) < now || auction.status === "closed") {
      await session.abortTransaction();
      return res
        .status(400)
        .json({ message: "Auction already ended or closed" });
    }

    // Fetch current highest / lowest *with bidder populated* inside session
    let currentHighest = null;
    let currentLowest = null;

    if (auction.type === "reverse") {
      currentLowest = await Bid.findOne({ auction: auctionId })
        .sort({ amount: 1 })
        .populate("bidder")
        .session(session);
    } else {
      currentHighest = await Bid.findOne({ auction: auctionId })
        .sort({ amount: -1 })
        .populate("bidder")
        .session(session);
    }

    // Validation rules
    if (auction.type === "reverse") {
      const minInc = Number(auction.minIncrement || 1);
      const baseline = currentLowest
        ? Number(currentLowest.amount)
        : Number(auction.startPrice || 0);

      if (currentLowest) {
        // require strictly lower by at least minInc
        if (!(parsedAmount <= baseline - minInc)) {
          await session.abortTransaction();
          return res.status(400).json({
            message: `Bid must be at least ₹${minInc} lower than current lowest (${baseline})`,
          });
        }
      } else {
        // first reverse bid may be <= startPrice
        if (!(parsedAmount <= baseline)) {
          await session.abortTransaction();
          return res
            .status(400)
            .json({ message: `Initial reverse bid must be ≤ ₹${baseline}` });
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

    // Determine outbid user (only for non-sealed auctions)
    let outbidUserId = null;
    if (
      currentHighest &&
      auction.type !== "sealed" &&
      currentHighest.bidder &&
      currentHighest.bidder._id?.toString() !== req.user._id.toString()
    ) {
      outbidUserId = currentHighest.bidder._id;
    }

    // Create bid (inside session)
    const createdBidDoc = await Bid.create(
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
    // create returns an array
    const created = createdBidDoc[0];

    // Anti-sniping: extend if last N seconds (apply only for traditional/sealed)
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

    // Post-commit: send outbid email if applicable
    try {
      if (outbidUserId) {
        // fetch outbid user's full record (do NOT trust earlier populated doc inside session)
        const outbidUser = await User.findById(outbidUserId).lean();
        if (
          outbidUser &&
          outbidUser.email &&
          outbidUser.notificationSettings?.newBid !== false
        ) {
          const html = `<h3>Hello ${outbidUser.name || "User"}</h3>
            <p>You were outbid on <b>${
              auction.product?.title || "an item"
            }</b>.</p>
            <p>Current highest: ₹${parsedAmount}</p>
            <p><a href="${
              process.env.FRONTEND_URL
            }/auction/${auctionId}">Click to place a higher bid</a></p>`;
          // Fire & forget; don't block request
          sendMail(outbidUser.email, "You've been outbid", html).catch((e) =>
            console.error("Outbid email failed:", e?.message || e)
          );
        }
      }
    } catch (emailErr) {
      console.error("Outbid email flow error:", emailErr?.message || emailErr);
    }

    // Socket emit (use getIO with fallback)
    try {
      const io = (() => {
        try {
          return getIO();
        } catch {
          return global.io || null;
        }
      })();

      const payload = {
        auctionId,
        bid: {
          _id: created._id,
          amount: created.amount,
          bidder:
            auction.type === "sealed"
              ? null
              : { id: req.user._id, name: req.user.name },
          createdAt: created.createdAt,
          sealed: auction.type === "sealed",
        },
        extended,
      };

      if (io) {
        io.to(`auction:${auctionId}`).emit("newBid", payload);
      }
    } catch (emitErr) {
      console.error("Socket emit error:", emitErr?.message || emitErr);
    }

    // Return created bid (do not leak bidder info for sealed auctions)
    const responseBid = {
      _id: created._id,
      amount: created.amount,
      createdAt: created.createdAt,
      sealed: created.sealed,
      bidder:
        auction.type === "sealed"
          ? null
          : { id: req.user._id, name: req.user.name },
    };

    return res.status(201).json({ message: "Bid placed", bid: responseBid });
  } catch (err) {
    try {
      await session.abortTransaction();
    } catch (e) {}
    session.endSession();
    next(err);
  }
};

/**
 * getBidsForAuction
 * - sealed auctions hide bids until closed
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

    // For reverse auctions, return ascending (lowest first) is more intuitive to buyer
    const sortObj = auction.type === "reverse" ? { amount: 1 } : { amount: -1 };

    const bids = await Bid.find({ auction: auctionId })
      .populate("bidder", "name email")
      .sort(sortObj);

    return res.json(bids);
  } catch (err) {
    next(err);
  }
};

/**
 * getBuyerSummary - simplified metrics
 */
export const getBuyerSummary = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const totalBids = await Bid.countDocuments({ bidder: userId });

    // count won auctions: prefer winnerBid pointer on auctions
    const auctionsWon = await Auction.find({
      status: "closed",
      winnerBid: { $exists: true },
    }).select("winnerBid");
    let wonAuctions = 0;
    for (const a of auctionsWon) {
      if (!a.winnerBid) continue;
      const winnerBid = await Bid.findById(a.winnerBid).select("bidder");
      if (winnerBid && winnerBid.bidder?.toString() === userId.toString())
        wonAuctions++;
    }

    // activeBids: number of distinct auctions user has active bids in (endAt > now)
    const activeBidsAgg = await Bid.aggregate([
      { $match: { bidder: mongoose.Types.ObjectId(userId) } },
      {
        $lookup: {
          from: "auctions",
          localField: "auction",
          foreignField: "_id",
          as: "auction",
        },
      },
      { $unwind: "$auction" },
      {
        $match: {
          "auction.endAt": { $gt: new Date() },
          "auction.status": { $ne: "closed" },
        },
      },
      { $group: { _id: "$auction._id" } },
      { $count: "count" },
    ]);

    const activeBids = activeBidsAgg[0]?.count || 0;

    return res.json({ totalBids, wonAuctions, activeBids });
  } catch (err) {
    next(err);
  }
};
