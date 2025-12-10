import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const registerUser = async (req, res, next) => {
  try {
    const { name, email, password, role, contact } = req.body;
    if (!name || !email || !password)
      return res
        .status(400)
        .json({ message: "Name, email and password required" });

    const existing = await User.findOne({ email });
    if (existing)
      return res.status(400).json({ message: "User already exists" });

    const saltRounds = Number(
      process.env.SALT_ROUNDS || process.env.SALT || 10
    );
    const salt = await bcrypt.genSalt(saltRounds);
    const hashed = await bcrypt.hash(password, salt);

    const newUser = await User.create({
      name,
      email,
      hashPassword: hashed,
      role: role || "buyer",
      contact,
    });

    const token = jwt.sign({ id: newUser._id }, process.env.SECRET_KEY, {
      expiresIn: "7d",
    });

    res.status(201).json({
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

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.hashPassword);
    if (!match) return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: user._id }, process.env.SECRET_KEY, {
      expiresIn: "7d",
    });

    res.json({
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
    res.json({ user: req.user });
  } catch (err) {
    next(err);
  }
};

export const updateNotificationSettings = async (req, res) => {
  try {
    const user = req.user;
    const { auctionEnd, newBid } = req.body;

    user.notificationSettings.auctionEnd =
      auctionEnd ?? user.notificationSettings.auctionEnd;

    user.notificationSettings.newBid =
      newBid ?? user.notificationSettings.newBid;

    await user.save();

    res.json({ message: "Notification settings updated", user });
  } catch (err) {
    res.status(500).json({ message: "Failed to update settings" });
  }
};
