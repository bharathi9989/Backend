import Auction from "../model/Auction.js";
import Bid from "../model/Bid.js";
import { getIO } from "../socket.js";

export const placeBid = async (req, res) => {
  try {
    const { auctionId, amount } = req.body;

    // 1️⃣ Role validation
    if (req.user.role !== "buyer") {
      return res.status(403).json({ message: "Only Buyer can Place Bid" });
    }

    // 2️⃣ Validate auction
    const auction = await Auction.findById(auctionId).populate("product");
    if (!auction) {
      return res.status(404).json({ message: "Auction not found" });
    }

    // 3️⃣ Check auction status

    const now = new Date();
    if (new Date(auction.startAt) > now) {
      return res.status(400).json({ message: "Auction not started Yet" });
    }
    if (new Date(auction.endAt) < now) {
      return res.status(400).json({ message: "Auction already Ended" });
    }
    if (auction.status === "closed") {
      return res.status(400).json({ message: "Auction closed" });
    }

    // 4️⃣ Get last highest bid

    const lastBid = await Bid.find({ auction: auctionId })
      .sort({ amount: -1 })
      .limit(1);

    let minRequiredBid = auction.startPrice;
    if (lastBid.length > 0) {
      minRequiredBid = lastBid[0].amount + auction.minIncrement;
    }

    // 5️⃣ Validate bid amount

    if (amount < minRequiredBid) {
      return res
        .status(400)
        .json({ message: `Bid must be atleast,${minRequiredBid}` });
    }

    // 6️⃣ Create new bid

    const newBid = await Bid.create({
      auction: auctionId,
      bidder: req.user._id,
      amount,
    });

    // 7️⃣ Broadcast to all users in auction room (Socket.IO)

    const io = getIO();
    io.to(`auction : ${auctionId}`).emit("newBid", {
      amount,
      bidder: req.user._id,
      time: new Date(),
    });

    res.status(201).json({
      message: "Bid Placed Successfully",
      bid: newBid,
    });
  } catch (err) {
    console.error("❌ Error placing bid:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * @desc Get all bids for an auction
 * @route GET /api/bids/:auctionId
 * @access Public
 */

export const getBidsForAuction = async (req, res) => {
  try {
    const bids = await Bid.find({ auction: req.params.auctionId })
      .populate("bidder", "name email")
      .sort({ amount: -1 });
    res.json(bids);
  } catch (err) {
    console.error("❌ Error fetching bids:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};
