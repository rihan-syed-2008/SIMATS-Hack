const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
require("dotenv").config();

const app = require("./src/app");
const connectDB = require("./src/config/db");

const Room = require("./src/models/Room");

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
const roomHosts = {};

io.on("connection", (socket) => {
  socket.on("end_room", async ({ roomCode }) => {
    if (roomHosts[roomCode] !== socket.userId) return;

    io.to(roomCode).emit("room_ended");

    // Clean memory
    delete roomUsers[roomCode];
    delete roomBoards[roomCode];
    delete roomTimers[roomCode];
    delete roomHosts[roomCode];
    delete roomPermissions[roomCode];

    // Delete from MongoDB
    await Room.deleteOne({ code: roomCode });

    console.log("Room deleted:", roomCode);
  });

  socket.on("transfer_host", ({ roomCode, newHostId }) => {
    if (!roomHosts[roomCode]) return;

    // Only current host can transfer
    if (roomHosts[roomCode] !== socket.userId) return;

    roomHosts[roomCode] = newHostId;

    io.to(roomCode).emit("host_changed", {
      newHostId,
    });

    io.to(roomCode).emit("system_message", {
      message: `Host transferred`,
    });
  });

  socket.on("typing", ({ roomCode, username }) => {
    socket.to(roomCode).emit("user_typing", username);
  });

  socket.on("stop_typing", ({ roomCode }) => {
    socket.to(roomCode).emit("user_stop_typing");
  });

  socket.on("remove_last_stroke", ({ roomCode }) => {
    if (roomBoards[roomCode] && roomBoards[roomCode].length > 0) {
      roomBoards[roomCode].pop();
    }

    io.to(roomCode).emit("board_history", roomBoards[roomCode]);
  });

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
    socket.username = username;
    socket.userId = userId;
    socket.to(roomCode).emit("system_message", {
      message: `${username} joined the room`,
    });

    if (!roomHosts[roomCode]) {
      roomHosts[roomCode] = userId; // first user becomes host
    }

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

  socket.on("send_message", (data) => {
    io.to(data.room).emit("receive_message", data);
  });

  socket.on("disconnect", async () => {
    for (const roomCode in roomUsers) {
      const user = roomUsers[roomCode]?.find((u) => u.id === socket.id);

      if (user) {
        // Remove user
        roomUsers[roomCode] = roomUsers[roomCode].filter(
          (u) => u.id !== socket.id,
        );

        io.to(roomCode).emit("update_participants", roomUsers[roomCode]);

        io.to(roomCode).emit("system_message", {
          message: `${user.username} left the room`,
        });

        // Transfer host if needed
        if (roomUsers[roomCode].length > 0) {
          const newHost = roomUsers[roomCode][0];
          roomHosts[roomCode] = newHost.userId;

          io.to(roomCode).emit("host_changed", {
            newHostId: newHost.userId,
          });
        } else {
          delete roomUsers[roomCode];
          delete roomBoards[roomCode];
          delete roomTimers[roomCode];
          delete roomHosts[roomCode];
          delete roomPermissions[roomCode];

          // 🔥 Delete from MongoDB
          await Room.deleteOne({ code: roomCode });

          console.log("Room deleted (empty):", roomCode);
        }
      }
    }
  });
  socket.on("leave_room", ({ roomCode }) => {
    socket.leave(roomCode);

    if (!roomUsers[roomCode]) return;

    // 1️⃣ Remove the leaving user FIRST
    roomUsers[roomCode] = roomUsers[roomCode].filter(
      (user) => user.id !== socket.id,
    );

    // 2️⃣ Update participants
    io.to(roomCode).emit("update_participants", roomUsers[roomCode]);

    // 3️⃣ Send system message
    io.to(roomCode).emit("system_message", {
      message: `${socket.username} left the room`,
    });

    // 4️⃣ If users remain → assign new host
    if (roomUsers[roomCode].length > 0) {
      const newHost = roomUsers[roomCode][0];

      roomHosts[roomCode] = newHost.userId;

      io.to(roomCode).emit("host_changed", {
        newHostId: newHost.userId,
      });
    } else {
      // Room empty
      delete roomUsers[roomCode];
    }

    console.log("User left room:", roomCode);
  });
});

const PORT = process.env.PORT || 5000;

// IMPORTANT: use server.listen, NOT app.listen
server.listen(5000, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
