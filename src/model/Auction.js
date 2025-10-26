import mongoose, { model, Schema, Types } from "mongoose";

const auctionSchema = Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  seller: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  type: {
    type: String,
    enum: ["traditional", "reverse", "sealed"],
    default: "traditional",
  },
  startPrice: { type: Number, required: true },
  minIncrement: { type: Number, default: 100 },
  startAt: { type: Date, required: true },
  endAt: { type: Date, required: true },
  status: {
    type: String,
    enum: ["upcoming", "live", "closed"],
    default: "upcoming",
  },
  createdAt: { type: Date, default: Date.now },
});

const Auction = model("Auction", auctionSchema);
export default Auction;
