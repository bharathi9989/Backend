import Product from "../models/Product.js";

export const createProduct = async (req, res, next) => {
  try {
    if (req.user.role !== "seller")
      return res
        .status(403)
        .json({ message: "Only sellers can create products" });
    const { title, description, images, category, inventoryCount } = req.body;
    if (!title || !category)
      return res.status(400).json({ message: "Title and category required" });

    const product = await Product.create({
      seller: req.user._id,
      title,
      description,
      images: images || [],
      category,
      inventoryCount: inventoryCount ?? 1,
    });

    res.status(201).json({ message: "Product created", product });
  } catch (err) {
    next(err);
  }
};

export const getAllProduct = async (req, res, next) => {
  try {
    const products = await Product.find().populate("seller", "name email");
    res.json(products);
  } catch (err) {
    next(err);
  }
};

export const updateProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });
    if (!product.seller.equals(req.user._id))
      return res.status(403).json({ message: "Not authorized" });

    Object.assign(product, req.body);
    await product.save();
    res.json({ message: "Product updated", product });
  } catch (err) {
    next(err);
  }
};

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
