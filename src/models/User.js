import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    hashPassword: { type: String, required: true },
    role: {
      type: String,
      enum: ["buyer", "seller", "admin"],
      default: "buyer",
    },
    contact: { type: String },
    notificationSettings: {
      outbid: { type: Boolean, default: true },
      win: { type: Boolean, default: true },
      auctionStart: { type: Boolean, default: true },
      auctionEnd: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

const User = mongoose.models.User || mongoose.model("User", userSchema);
export default User;
