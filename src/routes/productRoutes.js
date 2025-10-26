import { Router } from "express";
import auth from "../middlewares/auth.js";
import {
  createProduct,
  deleteProduct,
  getAllProduct,
  UpdateProduct,
} from "../controllers/productController.js";

const productRoutes = Router();

productRoutes.post("/", auth, createProduct);
productRoutes.get("/", getAllProduct);
productRoutes.put("/:id", auth, UpdateProduct);
productRoutes.delete("/:id", auth, deleteProduct);

export default productRoutes;
