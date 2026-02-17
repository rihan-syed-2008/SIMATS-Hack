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
const roomTimers = {};

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

  socket.on("draw", ({ roomCode, x, y, prevX, prevY, color, lineWidth }) => {
    socket.to(roomCode).emit("draw", {
      x,
      y,
      prevX,
      prevY,
      color,
      lineWidth,
    });
  });

  socket.on("clear_board", ({ roomCode }) => {
    io.to(roomCode).emit("clear_board");
  });

  socket.on("start_timer", ({ roomCode, duration }) => {
    console.log("Timer started for room:", roomCode);
    const endTime = Date.now() + duration;

    roomTimers[roomCode] = {
      endTime,
      duration,
      remainingTime: duration,
      isRunning: true,
      isPaused: false,
    };

    io.to(roomCode).emit("timer_update", roomTimers[roomCode]);
  });

  socket.on("pause_timer", ({ roomCode }) => {
    const timer = roomTimers[roomCode];
    if (!timer || timer.isPaused) return;

    const remaining = timer.endTime - Date.now();

    timer.remainingTime = remaining;
    timer.isPaused = true;
    timer.isRunning = false;

    io.to(roomCode).emit("timer_update", timer);
  });

  socket.on("resume_timer", ({ roomCode }) => {
    const timer = roomTimers[roomCode];
    if (!timer || !timer.isPaused) return;

    timer.endTime = Date.now() + timer.remainingTime;
    timer.isPaused = false;
    timer.isRunning = true;

    io.to(roomCode).emit("timer_update", timer);
  });

  socket.on("reset_timer", ({ roomCode }) => {
    const timer = roomTimers[roomCode];
    if (!timer) return;

    timer.isRunning = false;
    timer.isPaused = false;
    timer.remainingTime = timer.duration;

    io.to(roomCode).emit("timer_update", timer);
  });

  socket.on("join_room", ({ roomCode, username, userId }) => {
    socket.join(roomCode);

    if (!roomUsers[roomCode]) {
      roomUsers[roomCode] = [];
    }

    roomUsers[roomCode] = roomUsers[roomCode].filter(
      (user) => user.userId !== userId,
    );

    roomUsers[roomCode].push({
      id: socket.id,
      username,
      userId,
    });

    io.to(roomCode).emit("update_participants", roomUsers[roomCode]);

    if (roomTimers[roomCode]) {
      socket.emit("timer_started", roomTimers[roomCode]);
    }

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
  socket.on("leave_room", ({ roomCode }) => {
    socket.leave(roomCode);
    console.log("Before:", roomUsers[roomCode]);

    if (roomUsers[roomCode]) {
      roomUsers[roomCode] = roomUsers[roomCode].filter(
        (user) => user.id !== socket.id,
      );
      console.log("After:", roomUsers[roomCode]);

      io.to(roomCode).emit("update_participants", roomUsers[roomCode]);
    }

    console.log("User left room:", roomCode);
  });
});

const PORT = process.env.PORT || 5000;

// IMPORTANT: use server.listen, NOT app.listen
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
