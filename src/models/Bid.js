import mongoose from "mongoose";

const bidSchema = new mongoose.Schema(
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
    sealed: { type: Boolean, default: false }, // sealed flag
  },
  { timestamps: true }
);

bidSchema.index({ auction: 1, amount: -1 }); // perf for top bids

const Bid = mongoose.models.Bid || mongoose.model("Bid", bidSchema);
export default Bid;
