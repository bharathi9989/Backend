import User from "../model/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const registerUser = async (req, res) => {
  try {
    const { name, email, password, role, contact } = req.body;
    // console.log(req.body);

    const existingUser = await User.findOne({ email });

    // 1️⃣ Check if user already exists

    if (existingUser) {
      return res.status(400).json({
        message: "user already exists",
      });
    }

    // 2️⃣ Hash the password before saving

    const salt = await bcrypt.genSalt(Number(process.env.SALT));
    const hashPassword = await bcrypt.hash(password, salt);

    // 3️⃣ Create New User

    const newUser = await User.create({
      name,
      email,
      hashPassword,
      role: role || "buyer",
      contact,
    });

    // 4️⃣ Generate JWT token

    const token = jwt.sign({ id: newUser._id }, process.env.SECRET_KEY, {
      expiresIn: "7d",
    });

    // 5️⃣ Send response

    res.status(200).json({
      message: "user created successfully",
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      },
      token,
    });
  } catch (err) {
    console.log("❌ Error registering user", err);
    res.status(500).json({ message: "server Error" });
  }
};

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1️⃣ Check if user exists

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({
        message: "Invalid credentials",
      });
    }
    // 2️⃣ Compare entered password with stored hash

    const isMatch = await bcrypt.compare(password, user.hashPassword);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid Credentials" });
    }

    // 3️⃣ Generate JWT token

    const token = jwt.sign({ id: user._id }, process.env.SECRET_KEY, {
      expiresIn: "7d",
    });

    // 4️⃣ Send response

    res.json({
      message: "Login Successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      token,
    });
  } catch (err) {
    console.log("Login Error");
    res.status({
      message: "Server Error",
    });
  }
};
