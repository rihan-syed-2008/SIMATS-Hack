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
const roomBoards = {};
const roomPermissions = {};

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

  socket.on("grant_permission", ({ roomCode, userId }) => {
    if (!roomPermissions[roomCode]) {
      roomPermissions[roomCode] = [];
    }
    if (!roomPermissions[roomCode].includes(userId)) {
      roomPermissions[roomCode].push(userId);
    }

    io.to(roomCode).emit("update_permissions", roomPermissions[roomCode]);
  });

  socket.on("revoke_permission", ({ roomCode, userId }) => {
    roomPermissions[roomCode] = roomPermissions[roomCode].filter(
      (id) => id !== userId,
    );

    io.to(roomCode).emit("update_permissions", roomPermissions[roomCode]);
  });

  socket.on("draw", ({ roomCode, x, y, prevX, prevY, color, lineWidth }) => {
    if (!roomBoards[roomCode]) {
      roomBoards[roomCode] = [];
    }

    const stroke = { x, y, prevX, prevY, color, lineWidth };

    roomBoards[roomCode].push(stroke);

    socket.to(roomCode).emit("draw", stroke);
  });

  socket.on("join_room", ({ roomCode, username, userId }) => {
    socket.join(roomCode);

    if (!roomPermissions[roomCode]) {
      roomPermissions[roomCode] = [];
    }

    if (!roomUsers[roomCode]) {
      roomUsers[roomCode] = [];
    }

    if (roomBoards[roomCode]) {
      socket.emit("board_history", roomBoards[roomCode]);
    }

    socket.emit("update_permissions", roomPermissions[roomCode] || []);

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

  socket.on("clear_board", ({ roomCode }) => {
    roomBoards[roomCode] = [];
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
    console.log("Sending history:", roomBoards[roomCode]);

    if (!roomUsers[roomCode]) {
      roomUsers[roomCode] = [];
    }

    if (roomBoards[roomCode]) {
      socket.emit("board_history", roomBoards[roomCode]);
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
server.listen(5000, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
