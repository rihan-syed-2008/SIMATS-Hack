const express = require("express");
const router = express.Router();
const {
  createRoom,
  joinRoom,
  getRoom,
} = require("../controllers/roomController");
const authMiddleware = require("../middleware/authMiddleware");
const Room = require("../models/Room");

router.post("/create", authMiddleware, createRoom);
router.post("/join", authMiddleware, joinRoom);
router.get("/:code", authMiddleware, getRoom);

router.post("/schedule", authMiddleware, async (req, res) => {
  try {
    const { title, scheduledFor, duration } = req.body;

    const roomCode = Math.random().toString(36).substring(2, 8);

    const room = await Room.create({
      code: roomCode,
      host: req.user.id,
      scheduledFor,
      duration,
      isActive: false,
    });

    res.json(room);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to schedule meeting" });
  }
});

module.exports = router;
