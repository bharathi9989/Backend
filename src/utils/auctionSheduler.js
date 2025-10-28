import nodeCron from "node-cron";
import Auction from "../model/Auction.js";
import Bid from "../model/Bid.js";
import { sendMail } from "./mailer.js";

/**
 * Runs every minute to check if any auction has ended.
 * If auction end time < now and status != closed, it will:
 * - Mark it as closed
 * - Find highest bid (winner)
 * - Send email to seller and winner
 */

export const startAuctionSheduler = () => {
  nodeCron.schedule("* * * * *", async () => {
    console.log(" ⏰ checking for ended auction");

    const now = new Date();
    const endedAuctions = await Auction.find({
      endAt: { $lte: now },
      status: { $ne: "closed" },
    })
      .populate("seller")
      .populate("product");

    for (const auction of endedAuctions) {
      auction.status = "closed";
      auction.save();

      // Find highest bid (for traditional auction)

      const highestBid = await Bid.findOne({ auction: auction._id })
        .sort({ amount: -1 })
        .populate("bidder");

      // Send mail to seller
      await sendMail(
        auction.seller.email,
        `Your auction for "${auction.product.title}" has ended`,
        `<h3>Hello ${auction.seller.name},</h3>
            <p>Your auction <b>${auction.product.title}</b> has been closed.</p>
            
            ${
              highestBid
                ? `<p> winner : ${highestBid.bidder.name} (${highestBid.amount}₹)</P>`
                : "<p>No Bids were placed</p>"
            }
            <p>Thank you for using Auction Platform.</p>`
      );

      // Send mail to winner
      
        if (highestBid) {
            await sendMail(
                highestBid.bidder.email,
                `congaratulation 🥂 You Won "${auction.product.title}"`,
                `<h1>Hi ${highestBid.bidder.name},</h1>
                <p>You have won the auction for <b>${auction.product.title}</b> with your bid of ₹${highestBid.amount}.</p>
                <p>The seller will contact you soon.</p>`
            )
        }

        console.log(`✅ Auction ${auction._id} closed successfully`);
        
    }
  });
};
