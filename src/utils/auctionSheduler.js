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

        // -----------------------------------------
        // 🏆 Choose winner based on auction type
        // -----------------------------------------
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

        // -----------------------------------------
        // 📦 Handle Product inventory
        // -----------------------------------------
        if (winnerBid) {
          auction.winnerBid = winnerBid._id;

          const product = auction.product;
          if (product && product.inventoryCount > 0) {
            product.inventoryCount -= 1;

            if (product.inventoryCount <= 0) product.status = "sold";

            await product.save();
          }
        } else {
          // No winner → product remains unsold
          const product = auction.product;
          if (product) {
            product.status = "unsold";
            await product.save();
          }
        }

        await auction.save();

        // -----------------------------------------
        // ✉️ Notify Seller — ONLY IF ENABLED
        // -----------------------------------------
        const sellerNotifyOn =
          auction.seller?.notificationSettings?.auctionEnd !== false;

        if (auction.seller?.email && sellerNotifyOn) {
          const sellerHtml = `
            <h3>Hello ${auction.seller.name}</h3>
            <p>Your auction <b>${
              auction.product?.title || "product"
            }</b> has ended.</p>
            ${
              winnerBid
                ? `<p>Winner: ${winnerBid.bidder.name} — ₹${winnerBid.amount}</p>`
                : "<p>No valid bids were placed.</p>"
            }
          `;

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

        // -----------------------------------------
        // 🏆 Notify Winner — ONLY IF ENABLED
        // -----------------------------------------
        const winnerNotifyOn =
          winnerBid?.bidder?.notificationSettings?.win !== false;

        if (winnerBid && winnerBid.bidder?.email && winnerNotifyOn) {
          const winnerHtml = `
            <h3>Congratulations ${winnerBid.bidder.name} 🎉</h3>
            <p>You won <b>${auction.product?.title}</b>!</p>
            <p>Winning Amount: <b>₹${winnerBid.amount}</b></p>
          `;

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

        // -----------------------------------------
        // 🔔 SOCKET EVENT TO CLIENTS
        // -----------------------------------------
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
