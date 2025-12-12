// src/controllers/productController.js
import Product from "../models/Product.js";

/**
 * createProduct - seller only
 */
export const createProduct = async (req, res, next) => {
  try {
    if (!req.user || req.user.role !== "seller")
      return res
        .status(403)
        .json({ message: "Only sellers can create products" });

    const { title, description = "", category, inventoryCount } = req.body;
    if (!title || !category)
      return res.status(400).json({ message: "Title and category required" });

    // images support: multer -> req.file.path OR body.images (array or JSON string)
    const images = [];
    if (req.file && req.file.path) images.push(req.file.path);
    else if (req.body.images) {
      try {
        const parsed =
          typeof req.body.images === "string"
            ? JSON.parse(req.body.images)
            : req.body.images;
        if (Array.isArray(parsed)) images.push(...parsed);
      } catch {
        if (typeof req.body.images === "string" && req.body.images.trim())
          images.push(req.body.images.trim());
      }
    }

    const product = await Product.create({
      seller: req.user._id,
      title: String(title).trim(),
      description: String(description).trim(),
      images,
      category: String(category).trim(),
      inventoryCount: Number(inventoryCount ?? 1),
      status: "active",
    });

    return res.status(201).json({ message: "Product created", product });
  } catch (err) {
    next(err);
  }
};

/**
 * getAllProduct
 * - If auth present and user is seller -> return only seller products
 * - Otherwise -> return public products (status active/unsold/sold as you choose)
 */
export const getAllProduct = async (req, res, next) => {
  try {
    const query = {};
    // Sellers see only their products
    if (req.user && req.user.role === "seller") query.seller = req.user._id;
    // Public: show active and unsold items; keep sold hidden for marketplace
    if (!req.user || req.user.role !== "seller") {
      query.status = { $in: ["active", "unsold"] };
    }

    const products = await Product.find(query).populate("seller", "name email");
    return res.json(products);
  } catch (err) {
    next(err);
  }
};

/**
 * updateProduct (seller only)
 */
export const updateProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });
    if (!product.seller.equals(req.user._id))
      return res.status(403).json({ message: "Not authorized" });

    const updates = {};
    if (req.body.title) updates.title = String(req.body.title).trim();
    if (req.body.description)
      updates.description = String(req.body.description).trim();
    if (req.body.category) updates.category = String(req.body.category).trim();
    if (req.body.inventoryCount != null)
      updates.inventoryCount = Number(req.body.inventoryCount);

    // images handling
    if (req.file && req.file.path) {
      // replace images array (common expectation)
      updates.images = [req.file.path];
    } else if (req.body.images) {
      try {
        const parsed =
          typeof req.body.images === "string"
            ? JSON.parse(req.body.images)
            : req.body.images;
        if (Array.isArray(parsed)) updates.images = parsed;
      } catch {
        if (typeof req.body.images === "string" && req.body.images.trim())
          updates.images = [req.body.images.trim()];
      }
    }

    Object.assign(product, updates);
    await product.save();
    return res.json({ message: "Product updated", product });
  } catch (err) {
    next(err);
  }
};

/**
 * deleteProduct (seller only)
 */
export const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });
    if (!product.seller.equals(req.user._id))
      return res.status(403).json({ message: "Not authorized" });

    await product.deleteOne();
    return res.json({ message: "Product deleted" });
  } catch (err) {
    next(err);
  }
};
