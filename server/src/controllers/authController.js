const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const generatePublicId = async (username) => {
  const User = require("../models/User"); // adjust path if needed

  let base = username.toLowerCase().replace(/\s+/g, "");
  let publicId;
  let exists = true;

  while (exists) {
    const random = Math.floor(1000 + Math.random() * 9000);
    publicId = `${base}_${random}`;

    const user = await User.findOne({ publicId });
    if (!user) exists = false;
  }

  return publicId;
};

exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const publicId = await generatePublicId(name);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      publicId,
    });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.status(201).json({
      message: "User registered successfully",
      token,
      name: user.name,
      userId: user._id,
      publicId: user.publicId,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Generate token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.json({
      message: "Login successful",
      token,
      name: user.name,
      userId: user._id,
      publicId: user.publicId,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};
const { OAuth2Client } = require("google-auth-library");

const axios = require("axios");

exports.googleLogin = async (req, res) => {
  try {
    const { token } = req.body;

    const googleRes = await axios.get(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    const { email, name, picture } = googleRes.data;

    let user = await User.findOne({ email });

    if (!user) {
      const publicId = await generatePublicId(name);

      user = await User.create({
        name,
        email,
        password: "google_oauth_user",
        publicId,
      });
    }

    const jwtToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.json({
      message: "Google login successful",
      token: jwtToken,
      name: user.name,
      userId: user._id,
      publicId: user.publicId,
    });
  } catch (error) {
    console.log("Google Login Error:", error.message);
    console.log(error.response?.data);
    res.status(401).json({ message: "Google authentication failed" });
  }
};
