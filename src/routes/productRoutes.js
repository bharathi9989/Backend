import express from "express";
import auth from "../middlewares/auth.js";
import {
  createProduct,
  getAllProduct,
  updateProduct,
  deleteProduct,
} from "../controllers/productController.js";

const router = express.Router();

router.post("/", auth, createProduct);
router.get("/", getAllProduct);
router.put("/:id", auth, updateProduct);
router.delete("/:id", auth, deleteProduct);

export default router;
