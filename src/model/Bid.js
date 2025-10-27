import mongoose, { model, Schema } from "mongoose";

/**
 * Bid Schema
 * - auction: auction reference
 * - bidder: user reference
 * - amount: bid amount
 * - createdAt: bid time
 */

const bidSchema = Schema(
  {
    auction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Auction",
      required: true,
    },
    bidder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    amount: { type: Number, required: true },
  },
  { timestamps: true }
);

const Bid = model("Bid", bidSchema);

export default Bid;
