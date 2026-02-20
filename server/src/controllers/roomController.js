const Room = require("../models/Room");

const generateCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

exports.startScheduledRoom = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const room = await Room.findById(id);

    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    if (room.host.toString() !== userId) {
      return res.status(403).json({ message: "Only host can start meeting" });
    }

    room.isActive = true;

    // Add host to participants if not already
    if (!room.participants.includes(userId)) {
      room.participants.push(userId);
    }

    await room.save();

    res.json(room);
  } catch (error) {
    console.error("Start Scheduled Room Error:", error);
    res.status(500).json({ message: "Failed to start meeting" });
  }
};

exports.createRoom = async (req, res) => {
  try {
    const userId = req.user.id; // from JWT middleware

    let code;
    let exists = true;

    while (exists) {
      code = generateCode();
      exists = await Room.findOne({ code });
    }

    const room = await Room.create({
      code,
      host: userId,
      participants: [userId],
      isActive: true, // ✅ IMPORTANT
      scheduledFor: null, // optional clarity
    });

    res.json(room);
  } catch (error) {
    console.error("Create Room Error:", error);
    res.status(500).json({ message: "Failed to create room" });
  }
};

exports.joinRoom = async (req, res) => {
  try {
    const { code } = req.body;
    const userId = req.user.id;

    const room = await Room.findOne({ code });

    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }
    // Only block scheduled rooms that are not active
    if (room.scheduledFor && !room.isActive) {
      return res
        .status(400)
        .json({ message: "Host has not started the meeting yet" });
    }

    if (!room.participants.includes(userId)) {
      room.participants.push(userId);
      await room.save();
    }

    res.json(room);
  } catch (error) {
    console.error("Join Room Error:", error);
    res.status(500).json({ message: "Failed to join room" });
  }
};

exports.getRoom = async (req, res) => {
  try {
    const room = await Room.findOne({ code: req.params.code });
    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }
    res.json(room);
  } catch (error) {
    res.status(500).json({ message: "Error fetching room" });
  }
};
