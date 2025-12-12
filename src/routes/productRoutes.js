import express from "express";
import auth from "../middlewares/auth.js";
import {
  createProduct,
  getAllProduct,
  updateProduct,
  deleteProduct,
} from "../controllers/productController.js";
import { upload } from "../middlewares/upload.js";

const router = express.Router();

router.post("/", auth, upload.single("image"), createProduct); // multipart
router.get("/", getAllProduct); // attach auth so seller-specific results
router.put("/:id", auth, upload.single("image"), updateProduct);
router.delete("/:id", auth, deleteProduct);

export default router;
