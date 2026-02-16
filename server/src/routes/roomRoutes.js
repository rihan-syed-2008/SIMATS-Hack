const express = require("express");
const router = express.Router();
const {
  createRoom,
  joinRoom,
  getRoom,
} = require("../controllers/roomController");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/create", authMiddleware, createRoom);
router.post("/join", authMiddleware, joinRoom);
router.get("/:code", authMiddleware, getRoom);

module.exports = router;
