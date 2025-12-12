// src/controllers/userController.js
import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const registerUser = async (req, res, next) => {
  try {
    const { name, email, password, role = "buyer", contact } = req.body;
    if (!name || !email || !password)
      return res
        .status(400)
        .json({ message: "Name, email and password required" });

    const existing = await User.findOne({ email });
    if (existing)
      return res.status(400).json({ message: "User already exists" });

    const saltRounds = Number(process.env.SALT_ROUNDS || 10);
    const salt = await bcrypt.genSalt(saltRounds);
    const hashed = await bcrypt.hash(password, salt);

    const newUser = await User.create({
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      hashPassword: hashed,
      role,
      contact,
    });

    const token = jwt.sign({ id: newUser._id }, process.env.SECRET_KEY, {
      expiresIn: "7d",
    });

    return res.status(201).json({
      message: "User registered",
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      },
      token,
    });
  } catch (err) {
    next(err);
  }
};

export const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Email and password required" });

    const user = await User.findOne({
      email: String(email).trim().toLowerCase(),
    });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.hashPassword);
    if (!match) return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: user._id }, process.env.SECRET_KEY, {
      expiresIn: "7d",
    });

    return res.json({
      message: "Login successful",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      token,
    });
  } catch (err) {
    next(err);
  }
};

export const me = async (req, res, next) => {
  try {
    if (!req.user)
      return res.status(401).json({ message: "Not authenticated" });
    return res.json({ user: req.user });
  } catch (err) {
    next(err);
  }
};

export const updateNotificationSettings = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: "Not authenticated" });

    const { auctionEnd, newBid } = req.body;
    user.notificationSettings = user.notificationSettings || {};
    if (auctionEnd != null) user.notificationSettings.auctionEnd = auctionEnd;
    if (newBid != null) user.notificationSettings.newBid = newBid;

    await user.save();
    return res.json({ message: "Notification settings updated", user });
  } catch (err) {
    console.error("updateNotificationSettings error:", err);
    return res.status(500).json({ message: "Failed to update settings" });
  }
};
