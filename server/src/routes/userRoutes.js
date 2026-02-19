const express = require("express");
const router = express.Router();
const User = require("../models/User");
const authMiddleware = require("../middleware/authMiddleware");

// Get Friends
router.get("/friends", authMiddleware, async (req, res) => {
  const user = await User.findById(req.user.id).populate(
    "friends",
    "name publicId",
  );

  res.json(user.friends);
});

// Add Friend
router.post("/add-friend", authMiddleware, async (req, res) => {
  const { friendPublicId } = req.body;

  const friend = await User.findOne({ publicId: friendPublicId });
  if (!friend) {
    return res.status(404).json({ message: "User not found" });
  }

  if (friend._id.toString() === req.user.id) {
    return res.status(400).json({ message: "You cannot add yourself" });
  }

  await User.findByIdAndUpdate(req.user.id, {
    $addToSet: { friends: friend._id },
  });

  await User.findByIdAndUpdate(friend._id, {
    $addToSet: { friends: req.user.id },
  });

  res.json({ message: "Friend added" });
});

module.exports = router;
