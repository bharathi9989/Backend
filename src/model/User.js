import mongoose, { Schema } from "mongoose";

const userSchema = Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    hashPassword: { type: String, required: true },
    role: {
      type: String,
      enum: ["buyer", "seller", "admin"],
      default: "buyer",
    },
    contact: { type: String },
  },
  { timeStamps: true }
);

const User = mongoose.model("User", userSchema);
export default User;
