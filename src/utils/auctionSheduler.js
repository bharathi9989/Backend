import nodeCron from "node-cron";
import Auction from "../models/Auction.js";
import Bid from "../models/Bid.js";
import Product from "../models/Product.js";
import { sendMail } from "./mailer.js";

/**
 * startAuctionScheduler(io)
 * Checks auctions ended and closes them. Emits via io.
 */
export const startAuctionScheduler = (io) => {
  // initial immediate check
  checkAndCloseAuctions(io).catch((err) =>
    console.error("Scheduler initial check failed:", err)
  );

  // schedule every minute
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
        // mark closed
        auction.status = "closed";

        // pick winner based on type
        let winnerBid = null;
        if (auction.type === "traditional" || auction.type === "sealed") {
          winnerBid = await Bid.findOne({ auction: auction._id })
            .sort({ amount: -1 })
            .populate("bidder");
        } else if (auction.type === "reverse") {
          winnerBid = await Bid.findOne({ auction: auction._id })
            .sort({ amount: 1 })
            .populate("bidder");
        }

        if (winnerBid) {
          auction.winnerBid = winnerBid._id;
          // mark product sold and decrement inventory
          const product = auction.product;
          if (product && product.inventoryCount > 0) {
            product.inventoryCount = product.inventoryCount - 1;
            if (product.inventoryCount <= 0) product.status = "sold";
            await product.save();
          }
        } else {
          // no winner — mark unsold
          const product = auction.product;
          if (product) {
            product.status = "unsold";
            await product.save();
          }
        }

        await auction.save();

        // notify seller
        if (auction.seller?.email) {
          const sellerHtml = `<h3>Hello ${auction.seller.name}</h3>
            <p>Your auction <b>${
              auction.product?.title || "product"
            }</b> ended.</p>
            ${
              winnerBid
                ? `<p>Winner: ${winnerBid.bidder.name} — ₹${winnerBid.amount}</p>`
                : "<p>No bids were placed.</p>"
            }`;
          try {
            await sendMail(
              auction.seller.email,
              `Your auction "${auction.product?.title}" ended`,
              sellerHtml
            );
          } catch (err) {
            console.error("Mail to seller failed:", err.message);
          }
        }

        // notify winner
        if (winnerBid && winnerBid.bidder?.email) {
          const winnerHtml = `<h3>Congrats ${winnerBid.bidder.name}</h3>
            <p>You won <b>${auction.product?.title}</b> with ₹${winnerBid.amount}.</p>`;
          try {
            await sendMail(
              winnerBid.bidder.email,
              `You won "${auction.product?.title}"`,
              winnerHtml
            );
          } catch (err) {
            console.error("Mail to winner failed:", err.message);
          }
        }

        // socket emit
        if (io) {
          io.to(`auction:${auction._id}`).emit("auctionClosed", {
            auctionId: auction._id,
            winner: winnerBid
              ? {
                  id: winnerBid.bidder._id,
                  name: winnerBid.bidder.name,
                  amount: winnerBid.amount,
                }
              : null,
            time: new Date(),
          });
        }

        console.log(`✅ Auction closed: ${auction._id}`);
      } catch (procErr) {
        console.error("Error closing auction:", procErr);
      }
    }
  } catch (err) {
    console.error("Scheduler check error:", err);
  }
};
