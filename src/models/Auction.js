import mongoose from "mongoose";

const auctionSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ["traditional", "reverse", "sealed"],
      default: "traditional",
    },
    startPrice: { type: Number, required: true, min: 0 },
    minIncrement: { type: Number, default: 1, min: 0 },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ["upcoming", "live", "closed"],
      default: "upcoming",
    },
    winnerBid: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bid",
      default: null,
    },
  },
  { timestamps: true }
);

const Auction =
  mongoose.models.Auction || mongoose.model("Auction", auctionSchema);
export default Auction;
