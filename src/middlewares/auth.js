import jwt  from "jsonwebtoken";
import User from "../model/User.js";


export default async function auth(req, res, next) {
  try {
    // 1️⃣ Check if token exists in header

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer")) {
      return res.status(401).json({
        message: "No Token Provided",
      });
    }

    // 2️⃣ Extract the token (Bearer <token>)
    const token = authHeader.split(" ")[1];

    // 3️⃣ Verify token with secret key
    const decode = jwt.verify(token, process.env.SECRET_KEY);

    // 4️⃣ Fetch the user from DB (without password)
    const user = await User.findById(decode.id).select("-hashPassword");
    if (!user) {
      return res.status(401).json({
        message: "User Not Found",
      });
    }
    // 5️⃣ Attach user to request object
      req.user = user;
      
      next();
  } catch (err) {
      console.error("❌Auth Middleware Error", err.message)
      res.status(401).json({
          message:"Invalid or Expired Token"
      })
  }
}
