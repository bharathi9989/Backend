// src/controllers/productController.js
import Product from "../models/Product.js";

/**
 * Create product (seller only). Accepts multipart form-data with optional file field "image".
 */
export const createProduct = async (req, res, next) => {
  try {
    if (!req.user || req.user.role !== "seller") {
      return res
        .status(403)
        .json({ message: "Only sellers can create products" });
    }

    const { title, description, category, inventoryCount } = req.body;
    if (!title || !category) {
      return res.status(400).json({ message: "Title and category required" });
    }

    // Multer (Cloudinary) will attach file info at req.file
    const images = [];
    if (req.file && req.file.path) {
      images.push(req.file.path);
    } else if (req.body.images) {
      // fallback: support client sending array or single url in field 'images'
      try {
        const parsed =
          typeof req.body.images === "string"
            ? JSON.parse(req.body.images)
            : req.body.images;
        if (Array.isArray(parsed)) images.push(...parsed);
      } catch {
        // if it's a single URL string
        if (typeof req.body.images === "string" && req.body.images.trim())
          images.push(req.body.images.trim());
      }
    }

    const product = await Product.create({
      seller: req.user._id,
      title,
      description,
      images,
      category,
      inventoryCount: inventoryCount ?? 1,
      status: "active",
    });

    res.status(201).json({ message: "Product created", product });
  } catch (err) {
    next(err);
  }
};

/**
 * Get products.
 * If auth middleware attaches req.user and seller role then returns only that seller products.
 * Public access can also list all (depending on your design) — we'll keep seller-specific by default when auth present.
 */
export const getAllProduct = async (req, res, next) => {
  try {
    const query = {};

    if (req.user && req.user.role === "seller") {
      query.seller = req.user._id;
    }

    const products = await Product.find(query).populate("seller", "name email");
    res.json(products);
  } catch (err) {
    next(err);
  }
};

/**
 * Update product (seller only). Accepts multipart file "image" to replace/add.
 */
export const updateProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });
    if (!product.seller.equals(req.user._id))
      return res.status(403).json({ message: "Not authorized" });

    const updates = { ...req.body };

    // If file uploaded, replace images array with uploaded URL (or prepend)
    if (req.file && req.file.path) {
      // Option: replace first image
      updates.images = [req.file.path];
    } else if (req.body.images) {
      try {
        const parsed =
          typeof req.body.images === "string"
            ? JSON.parse(req.body.images)
            : req.body.images;
        if (Array.isArray(parsed)) updates.images = parsed;
      } catch {
        // keep as string
        if (typeof req.body.images === "string" && req.body.images.trim())
          updates.images = [req.body.images.trim()];
      }
    }

    Object.assign(product, updates);
    await product.save();
    res.json({ message: "Product updated", product });
  } catch (err) {
    next(err);
  }
};

/**
 * Delete product
 */
export const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });
    if (!product.seller.equals(req.user._id))
      return res.status(403).json({ message: "Not authorized" });

    await product.deleteOne();
    res.json({ message: "Product deleted" });
  } catch (err) {
    next(err);
  }
};
