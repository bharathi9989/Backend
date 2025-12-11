import nodeCron from "node-cron";
import Auction from "../models/Auction.js";
import Bid from "../models/Bid.js";
import Product from "../models/Product.js";
import { sendMail } from "./mailer.js";

/**
 * startAuctionScheduler(io)
 * Runs every minute and closes ended auctions.
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

const checkAndCloseAuctions = async (io) => {
  try {
    const now = new Date();

    const ended = await Auction.find({
      endAt: { $lte: now },
      status: { $ne: "closed" },
    })
      .populate("seller")
      .populate("product");

    for (const auction of ended) {
      try {
        auction.status = "closed";

        let winnerBid = null;

        if (auction.type === "traditional" || auction.type === "sealed") {
          winnerBid = await Bid.findOne({ auction: auction._id })
            .sort({ amount: -1 })
            .populate("bidder");
        } else {
          winnerBid = await Bid.findOne({ auction: auction._id })
            .sort({ amount: 1 })
            .populate("bidder");
        }

        const product = auction.product;

        // Save auction + product safely
        if (winnerBid && winnerBid.bidder) {
          auction.winnerBid = winnerBid._id;

          if (product && product.inventoryCount > 0) {
            product.inventoryCount -= 1;

            if (product.inventoryCount <= 0) {
              product.status = "sold";
            }

            await product.save();
          }
        } else {
          // No winner
          if (product && product.status !== "sold") {
            product.status = "unsold";
            await product.save();
          }
        }

        await auction.save();

        // -----------------------------------------
        // EMAILS (SAFE MODE)
        // -----------------------------------------
        try {
          if (auction.seller?.email) {
            await sendMail(
              auction.seller.email,
              `Auction ended: ${product?.title || "Product"}`,
              winnerBid
                ? `<p>Winner: ${winnerBid.bidder?.name} — ₹${winnerBid.amount}</p>`
                : `<p>No bids received.</p>`
            );
          }
        } catch (err) {
          console.log("Seller email failed:", err.message);
        }

        try {
          if (winnerBid?.bidder?.email) {
            await sendMail(
              winnerBid.bidder.email,
              `You won the auction!`,
              `<p>Winning Bid: ₹${winnerBid.amount}</p>`
            );
          }
        } catch (err) {
          console.log("Winner email failed:", err.message);
        }

        // SOCKET
        if (io) {
          io.to(`auction:${auction._id}`).emit("auctionClosed", {
            auctionId: auction._id,
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

        console.log(`✔ Scheduler closed auction: ${auction._id}`);
      } catch (procErr) {
        console.error("Error processing auction:", procErr);
      }
    }
  } catch (err) {
    console.error("Scheduler check error:", err);
  }
};
