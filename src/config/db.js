import mongoose from "mongoose";

const connectDB = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI not set in .env");
  try {
    // Use the new unified topology by default; connect options can be added if needed
    await mongoose.connect(uri);
    console.log("🔥 MongoDB connected");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message || err);
    throw err;
  }
};

export default connectDB;
