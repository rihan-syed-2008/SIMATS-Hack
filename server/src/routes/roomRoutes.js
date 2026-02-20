const express = require("express");
const router = express.Router();
const {
  createRoom,
  joinRoom,
  getRoom,
  startScheduledRoom,
} = require("../controllers/roomController");
const authMiddleware = require("../middleware/authMiddleware");
const Room = require("../models/Room");

router.post("/create", authMiddleware, createRoom);
router.post("/join", authMiddleware, joinRoom);
router.post("/start/:id", authMiddleware, startScheduledRoom);

router.post("/schedule", authMiddleware, async (req, res) => {
  try {
    const { title, scheduledFor, duration, invitedUsers } = req.body;

    const roomCode = Math.random().toString(36).substring(2, 8);
    if (new Date(scheduledFor) < new Date()) {
      return res.status(400).json({ message: "Cannot schedule in the past" });
    }

    const room = await Room.create({
      code: roomCode,
      title,
      host: req.user.id,
      scheduledFor,
      duration,
      invitedUsers,
      isActive: false,
    });

    res.json(room);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to schedule meeting" });
  }
});

router.get("/upcoming", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const rooms = await Room.find({
      scheduledFor: { $ne: null },
      $or: [
        { host: userId }, // sessions you created
        { invitedUsers: userId }, // sessions you were invited to
      ],
    }).sort({ scheduledFor: 1 }); // earliest first
    res.json(rooms);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch upcoming sessions" });
  }
});
router.get("/:code", authMiddleware, getRoom);

router.delete("/cancel/:id", authMiddleware, async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);

    if (!room) {
      return res.status(404).json({ message: "Meeting not found" });
    }

    // Only host can cancel
    if (room.host.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    await Room.findByIdAndDelete(req.params.id);

    res.json({ message: "Meeting cancelled" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to cancel meeting" });
  }
});

module.exports = router;
