import { Server } from "socket.io";
import mongoose from "mongoose";

let ioInstance = null;

export const initSocket = (server) => {
  ioInstance = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_ORIGIN || "*",
      methods: ["GET", "POST"],
    },
  });

  ioInstance.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    socket.on("joinAuction", (auctionId) => {
      if (!auctionId) return;
      if (!mongoose.isValidObjectId(auctionId)) return;
      const room = `auction:${auctionId}`;
      socket.join(room);
      console.log(`Socket ${socket.id} joined ${room}`);
    });

    socket.on("leaveAuction", (auctionId) => {
      if (!auctionId) return;
      const room = `auction:${auctionId}`;
      socket.leave(room);
    });

    socket.on("disconnect", () => {
      // optional cleanup
    });
  });

  return ioInstance;
};

export const getIO = () => {
  if (!ioInstance) throw new Error("Socket.io not initialized");
  return ioInstance;
};
