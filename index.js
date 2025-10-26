import express from "express";
import dotenv from "dotenv";
import connectDB from "./src/config/db.js";
import authRoutes from "./src/routes/authRoutes.js";
import productRoutes from "./src/routes/productRoutes.js";
import auctionRoutes from "./src/routes/auctionRoutes.js";

dotenv.config();

const app = express();

app.use(express.json());

app.use((req, res, next) => {
  console.log(req.method, req.url, new Date().toLocaleString());
  next();
});

app.get("/", (req, res) => {
  res.send("Auction Backend Running ✅");
});

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/auctions", auctionRoutes);

app.listen(process.env.PORT, () => {
  console.log("Application is Working well at ", process.env.PORT);
  connectDB();
});
