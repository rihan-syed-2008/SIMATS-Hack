require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
require("dotenv").config();

const userRoutes = require("./src/routes/userRoutes");

const app = require("./src/app");

const connectDB = require("./src/config/db");

const Room = require("./src/models/Room");

const roomRoutes = require("./src/routes/roomRoutes");

const aiRoutes = require("./src/routes/aiRoutes");
const roomQuizzes = {};
const roomLeaderboard = {};

const Groq = require("groq-sdk");
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
app.use("/api/rooms", roomRoutes);

app.use("/api/users", userRoutes);

app.use("/api/ai", aiRoutes);

// Connect DB
connectDB();

// CORS
app.use(
  cors({
    origin: "*",
    credentials: true,
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
    const room = await Room.findOne({ code: roomCode });
    if (!room) return;

    // Only DB host can end room

    console.log("DB Host:", room.host.toString());
    console.log("Socket User:", socket.userId);
    if (room.host.toString() !== socket.userId) return;

    io.to(roomCode).emit("room_ended");

    // Clean memory
    delete roomUsers[roomCode];
    delete roomBoards[roomCode];
    delete roomTimers[roomCode];
    delete roomPermissions[roomCode];

    // Delete from MongoDB
    await Room.deleteOne({ code: roomCode });

    console.log("Room deleted:", roomCode);
  });

  socket.on("end_quiz", ({ roomCode }) => {
    console.log("END QUIZ RECEIVED for room:", roomCode);
    delete roomQuizzes[roomCode];
    delete roomLeaderboard[roomCode];

    io.to(roomCode).emit("quiz_ended");
  });

  socket.on(
    "generate_room_quiz",
    async ({ roomCode, topic, questionCount, questionType }) => {
      const prompt = ` Generate ${questionCount} ${questionType} questions about "${topic}". Return ONLY valid JSON array in this EXACT format: [ { "question": "string", "type": "mcq" | "truefalse" | "fill", "options": ["option1","option2","option3","option4"], "correctAnswer": "string" } ] Rules: - For truefalse → options must be ["True","False"] - For fill → options must be [] - Do NOT include explanation. - Do NOT include text outside JSON. `;
      const completion = await groq.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "llama-3.3-70b-versatile",
      });
      const raw = completion.choices[0].message.content;
      const jsonStart = raw.indexOf("[");
      const jsonEnd = raw.lastIndexOf("]") + 1;
      const quiz = JSON.parse(raw.slice(jsonStart, jsonEnd));
      roomQuizzes[roomCode] = quiz;
      roomLeaderboard[roomCode] = {};
      io.to(roomCode).emit("quiz_started", quiz);
    },
  );

  socket.on("submit_quiz", ({ roomCode, answers }) => {
    const quiz = roomQuizzes[roomCode];
    if (!quiz) return;

    let score = 0;

    quiz.forEach((q, i) => {
      const correct =
        answers[i]?.toString().trim().toLowerCase() ===
        q.correctAnswer?.toString().trim().toLowerCase();

      if (correct) score++;
    });

    console.log("User answers:", answers);
    console.log(
      "Correct answers:",
      quiz.map((q) => q.correctAnswer),
    );

    if (!roomLeaderboard[roomCode]) {
      roomLeaderboard[roomCode] = {};
    }

    roomLeaderboard[roomCode][socket.userId] = {
      username: socket.username,
      score,
    };

    const sorted = Object.values(roomLeaderboard[roomCode]).sort(
      (a, b) => b.score - a.score,
    );

    io.to(roomCode).emit("leaderboard_update", sorted);
  });
  socket.on("webrtc_offer", ({ offer, to }) => {
    for (const [id, s] of io.sockets.sockets) {
      if (s.userId === to) {
        s.emit("webrtc_offer", {
          offer,
          from: socket.userId,
        });
      }
    }
  });

  socket.on("webrtc_answer", ({ answer, to }) => {
    for (const [id, s] of io.sockets.sockets) {
      if (s.userId === to) {
        s.emit("webrtc_answer", {
          answer,
          from: socket.userId,
        });
      }
    }
  });

  socket.on("webrtc_ice", ({ candidate, to }) => {
    for (const [id, s] of io.sockets.sockets) {
      if (s.userId === to) {
        s.emit("webrtc_ice", {
          candidate,
          from: socket.userId,
        });
      }
    }
  });

  socket.on("transfer_host", async ({ roomCode, newHostId }) => {
    const room = await Room.findOne({ code: roomCode });

    if (room && room.host.toString() === user.userId) {
      const newHost = roomUsers[roomCode][0];

      room.host = newHost.userId;
      await room.save();

      io.to(roomCode).emit("host_changed", {
        newHostId: newHost.userId,
      });
    }
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

    const stroke = { type: "stroke", x, y, prevX, prevY, color, lineWidth };

    roomBoards[roomCode].push(stroke);

    socket.to(roomCode).emit("draw", stroke);
  });
  socket.on("add_text", ({ roomCode, x, y, text, color, lineWidth }) => {
    if (!roomBoards[roomCode]) roomBoards[roomCode] = [];

    const textObject = {
      type: "text",
      x,
      y,
      text,
      color,
      lineWidth,
    };

    roomBoards[roomCode].push(textObject);

    socket.to(roomCode).emit("add_text", textObject);
  });

  socket.on("add_image_object", ({ roomCode, image }) => {
    if (!roomBoards[roomCode]) roomBoards[roomCode] = [];

    const imageObject = {
      type: "image",
      ...image,
    };

    roomBoards[roomCode].push(imageObject);

    socket.to(roomCode).emit("add_image_object", imageObject);
  });

  socket.on("delete_image_object", ({ roomCode, id }) => {
    if (!roomBoards[roomCode]) return;

    roomBoards[roomCode] = roomBoards[roomCode].filter(
      (obj) => !(obj.type === "image" && obj.id === id),
    );

    io.to(roomCode).emit("delete_image_object", id);
  });

  socket.on("move_image_object", ({ roomCode, id, x, y }) => {
    if (!roomBoards[roomCode]) return;

    roomBoards[roomCode] = roomBoards[roomCode].map((obj) =>
      obj.type === "image" && obj.id === id ? { ...obj, x, y } : obj,
    );

    socket.to(roomCode).emit("move_image_object", { id, x, y });
  });

  socket.on("join_room", async ({ roomCode, username, userId }) => {
    socket.join(roomCode);
    socket.username = username;
    socket.userId = userId;
    socket.to(roomCode).emit("system_message", {
      message: `${username} joined the room`,
    });

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

    const room = await Room.findOne({ code: roomCode });
    if (room) {
      io.to(roomCode).emit("host_changed", {
        newHostId: room.host.toString(),
      });
    }
    // 🔥 WEBRTC SIGNALING START
    const clients = Array.from(io.sockets.adapter.rooms.get(roomCode) || []);

    const existingUsers = clients
      .filter((id) => id !== socket.id)
      .map((id) => io.sockets.sockets.get(id).userId);

    socket.emit("existing_users", existingUsers);

    socket.to(roomCode).emit("new_user", {
      userId: socket.userId,
    });

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
          const room = await Room.findOne({ code: roomCode });
          if (room) {
            room.host = newHost.userId;
            await room.save();
          }

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
  socket.on("leave_room", async ({ roomCode }) => {
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

      const room = await Room.findOne({ code: roomCode });
      if (room) {
        room.host = newHost.userId;
        await room.save();
      }

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
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
