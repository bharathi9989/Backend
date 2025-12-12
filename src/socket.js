import { Server } from "socket.io";
import mongoose from "mongoose";

let ioInstance = null;

export const initSocket = (server) => {
  ioInstance = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173",
      methods: ["GET", "POST", "PUT"],
      credentials: true,
    },
    pingTimeout: 20000,
    pingInterval: 25000,
  });

  // Make socket available everywhere
  global.io = ioInstance;

  ioInstance.on("connection", (socket) => {
    console.log("⚡ Socket connected:", socket.id);

    /* -------------------------------
       JOIN AUCTION ROOM
    -------------------------------- */
    socket.on("joinAuction", (auctionId) => {
      if (!auctionId) return;

      if (!mongoose.isValidObjectId(auctionId)) {
        console.warn(`❗ Invalid auctionId for join: ${auctionId}`);
        return;
      }

      const room = `auction:${auctionId}`;
      socket.join(room);
      console.log(`✔️ Socket ${socket.id} joined room ${room}`);
    });

    /* -------------------------------
       LEAVE AUCTION ROOM
    -------------------------------- */
    socket.on("leaveAuction", (auctionId) => {
      if (!auctionId) return;
      const room = `auction:${auctionId}`;
      socket.leave(room);
      console.log(`↩️ Socket ${socket.id} left room ${room}`);
    });

    /* -------------------------------
       DISCONNECT
    -------------------------------- */
    socket.on("disconnect", (reason) => {
      console.log(`⚠️ Socket ${socket.id} disconnected: ${reason}`);
    });

    /* -------------------------------
       ERROR HANDLING
    -------------------------------- */
    socket.on("error", (err) => {
      console.error("Socket error:", err);
    });
  });

  console.log("🔌 Socket.io initialized");
  return ioInstance;
};

export const getIO = () => {
  if (!ioInstance) throw new Error("❌ Socket.io not initialized");
  return ioInstance;
};
