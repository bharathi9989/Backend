import nodeCron from "node-cron";
import mongoose from "mongoose";
import Auction from "../models/Auction.js";
import Bid from "../models/Bid.js";
import Product from "../models/Product.js";
import { sendMail } from "./mailer.js";

/**
 * Start auction scheduler
 * Runs every minute + runs once on boot.
 */
export const startAuctionScheduler = (io) => {
  checkAndCloseAuctions(io).catch((err) =>
    console.error("Scheduler initial check failed:", err)
  );

  nodeCron.schedule("* * * * *", async () => {
    await checkAndCloseAuctions(io);
  });

  console.log("✅ Auction scheduler started (runs every minute)");
};

/**
 * Safely close expired auctions
 */
const checkAndCloseAuctions = async (io) => {
  try {
    const now = new Date();

    // get all auctions needing closure
    const expiredAuctions = await Auction.find({
      endAt: { $lte: now },
      status: { $ne: "closed" },
    })
      .populate("product")
      .populate("seller");

    for (const auction of expiredAuctions) {
      await closeSingleAuction(auction, io);
    }
  } catch (err) {
    console.error("Scheduler error:", err);
  }
};

/**
 * Close one auction safely (with transaction)
 */
const closeSingleAuction = async (auction, io) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const auctionId = auction._id;
    const product = auction.product;

    if (!product) {
      console.error(`❗ Auction ${auctionId} has no product (skipped).`);
      await session.abortTransaction();
      return;
    }

    /* -------------------------------
       WINNER LOGIC (MATCH closeAuctionNow)
    -------------------------------- */
    let winnerBid = null;

    if (auction.type === "reverse") {
      winnerBid = await Bid.findOne({ auction: auctionId })
        .sort({ amount: 1 })
        .populate("bidder")
        .session(session);
    } else {
      // traditional + sealed
      winnerBid = await Bid.findOne({ auction: auctionId })
        .sort({ amount: -1 })
        .populate("bidder")
        .session(session);
    }

    /* -------------------------------
       UPDATE AUCTION
    -------------------------------- */
    auction.status = "closed";
    auction.winnerBid = winnerBid ? winnerBid._id : null;
    await auction.save({ session });

    /* -------------------------------
       UPDATE PRODUCT
    -------------------------------- */
    if (winnerBid) {
      product.inventoryCount = Math.max(0, product.inventoryCount - 1);
      product.status = product.inventoryCount === 0 ? "sold" : "active";
    } else {
      product.status = "unsold";
    }

    await product.save({ session });

    await session.commitTransaction();
    session.endSession();

    /* -------------------------------
       EMAILS (Non-blocking)
    -------------------------------- */
    sendAuctionEmails(auction, product, winnerBid);

    /* -------------------------------
       SOCKET EVENTS
    -------------------------------- */
    const socketIO = io || global.io;

    if (socketIO) {
      socketIO.to(`auction:${auctionId}`).emit("auctionClosed", {
        auctionId,
        closedBy: "scheduler",
        winner: winnerBid
          ? {
              id: winnerBid.bidder?._id,
              name: winnerBid.bidder?.name,
              amount: winnerBid.amount,
            }
          : null,
        time: new Date(),
      });
    }

    console.log(`✔ Scheduler closed auction ${auctionId}`);
  } catch (err) {
    await session.abortTransaction().catch(() => {});
    session.endSession();
    console.error("❌ Error closing auction:", err);
  }
};

/**
 * Sends all required emails (fire and forget)
 */
const sendAuctionEmails = async (auction, product, winnerBid) => {
  // email seller
  try {
    if (auction.seller?.email) {
      await sendMail(
        auction.seller.email,
        `Auction ended: ${product?.title}`,
        winnerBid
          ? `<p>Winner: ${winnerBid.bidder?.name} — ₹${winnerBid.amount}</p>`
          : `<p>No valid bids were placed.</p>`
      );
    }
  } catch (err) {
    console.log("Email to seller failed:", err.message);
  }

  // email winner
  try {
    if (winnerBid?.bidder?.email) {
      await sendMail(
        winnerBid.bidder.email,
        `You won the auction: ${product?.title}`,
        `<p>Your winning bid: ₹${winnerBid.amount}</p>`
      );
    }
  } catch (err) {
    console.log("Email to winner failed:", err.message);
  }
};
