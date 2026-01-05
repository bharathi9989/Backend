import dotenv from "dotenv";
dotenv.config();

import http from "http";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import connectDB from "./src/config/db.js";
import { initSocket, getIO } from "./src/socket.js";
import authRoutes from "./src/routes/authRoutes.js";
import productRoutes from "./src/routes/productRoutes.js";
import auctionRoutes from "./src/routes/auctionRoutes.js";
import bidRoutes from "./src/routes/bidRoutes.js";
import { startAuctionScheduler } from "./src/utils/auctionSheduler.js";
import { errorHandler } from "./src/middlewares/errorHandler.js";
import profileRoutes from "./src/routes/profileRoutes.js";
import userRoutes from "./src/routes/userRoutes.js";

const PORT = process.env.PORT || 4000;
const app = express();

// security middlewares (minimal)
app.use(helmet());
app.use(express.json());

const allowedOrigins = [
  "http://localhost:5173",
  "https://spiffy-medovik-94e665.netlify.app/",
];

app.use(
  cors({
    origin: (origin, callback) => {
      // allow server-to-server, Postman, curl
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // ❌ DO NOT THROW ERROR
      return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// simple logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.get("/", (req, res) => res.send("Auction Backend Running ✅"));

// routes
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/auctions", auctionRoutes);
app.use("/api/bids", bidRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/users", userRoutes);

// global error handler
app.use(errorHandler);

// create server + socket
const server = http.createServer(app);
initSocket(server); // initializes io instance

// start: ensure DB connected, then listen + start scheduler with io
const startServer = async () => {
  try {
    await connectDB();
    server.listen(PORT, () => console.log(`Server listening on ${PORT}`));
    // pass io to scheduler so it can emit events
    const io = getIO();
    startAuctionScheduler(io);
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
};

startServer();
