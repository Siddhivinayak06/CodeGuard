const express = require("express");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);
const pool = require("../utils/db");
const { createUser, findUserByEmail } = require("../models/userModel");

const router = express.Router();

// Register
router.post("/register", async (req, res) => {
  const { email, password } = req.body;
  try {
    const existing = await findUserByEmail(email);
    if (existing) return res.status(400).json({ error: "User already exists" });

    const user = await createUser(email, password);
    req.session.userId = user.id;
    res.json({ message: "User registered successfully", user });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await findUserByEmail(email);
    if (!user) return res.status(400).json({ error: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(400).json({ error: "Invalid credentials" });

    req.session.userId = user.id;
    res.json({ message: "Login successful", user: { id: user.id, email: user.email } });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Me
router.get("/me", (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: "Not logged in" });
  res.json({ userId: req.session.userId });
});

// Logout
router.post("/logout", (req, res) => {
  req.session.destroy();
  res.clearCookie("connect.sid");
  res.json({ message: "Logged out" });
});

module.exports = router;
