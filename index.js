import express from "express";
import dotenv from "dotenv";
import connectDB from "./src/config/db.js";
import authRouter from "./src/routes/authRoutes.js";

dotenv.config();

const app = express();

app.use(express.json());

app.use((req, res, next) => {
  console.log(req.method, req.url, new Date().toLocaleString());
  next();
});

app.use("/api/auth",authRouter)

app.listen(process.env.PORT, () => {
  console.log("Application is Working well at ");
  connectDB();
});
