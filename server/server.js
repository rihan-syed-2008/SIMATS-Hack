const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
require("dotenv").config();

const app = require("./src/app");
const connectDB = require("./src/config/db");

// Connect DB
connectDB();

// CORS
app.use(
  cors({
    origin: "*",
  }),
);

// Create HTTP server from Express app
const server = http.createServer(app);

// Attach Socket.io to that server
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

// Socket logic
const roomUsers = {};

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join_room", ({ roomCode, username, userId }) => {
    socket.join(roomCode);

    if (!roomUsers[roomCode]) {
      roomUsers[roomCode] = [];
    }

    roomUsers[roomCode].push({
      id: socket.id,
      username,
      userId,
    });
    io.to(roomCode).emit("update_participants", roomUsers[roomCode]);

    console.log(`${username} joined room ${roomCode}`);
  });

  socket.on("send_message", (data) => {
    io.to(data.room).emit("receive_message", data);
  });

  socket.on("disconnect", () => {
    for (const roomCode in roomUsers) {
      roomUsers[roomCode] = roomUsers[roomCode].filter(
        (user) => user.id !== socket.id,
      );

      io.to(roomCode).emit("update_participants", roomUsers[roomCode]);
    }

    console.log("User disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 5000;

// IMPORTANT: use server.listen, NOT app.listen
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
