import { Server, Socket } from "socket.io";

let io;
export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      orgin: "*", // frontend URL
    },
  });

  io.on(",connection", (socket) => {
    console.log("User connected", socket.id);

    socket.on("placeBid", (data) => {
      console.log("Bid recieved", data);
      io.emit("newBid", data); // broadcast
    });

    socket.io("diconnect", () => {
      console.log("user disconnected", socket.id);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
};
