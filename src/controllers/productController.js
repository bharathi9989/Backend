import Product from "../model/product.js";

/**
 * @desc Create new product (Seller only)
 * @route POST /api/products
 * @access Private
 */

export const createProduct = async (req, res) => {
  try {
    if (req.user.role !== "seller") {
      return res
        .status(403)
        .json({ message: "Only Seller can Create the Product" });
    }
    const { title, description, images, category, inventoryCount } = req.body;

    const product = await Product.create({
      seller: req.user._id,
      title,
      description,
      images,
      category,
      inventoryCount,
    });

    res.status(201).json({
      message: "Product Created Successsfully",
      product,
    });
  } catch (err) {
    console.log("Error creating Product", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * @desc Get all products
 * @route GET /api/products
 * @access Public
 */

export const getAllProduct = async (req, res) => {
  try {
    const products = await Product.find().populate("seller", "name email");
    res.json(products);
  } catch (err) {
    console.log(" Error Fetching Data", err.message);
    res.status(500).json({ message: "Server Error" });
  }
};

/**
 * @desc Update product (Seller only)
 * @route PUT /api/products/:id
 * @access Private
 */

export const UpdateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.json(403).json({ message: "Product not Found" });
    }

    // check if current user is product owner

    if (product.seller.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "Not authorized to update this product" });
    }

    const { title, description, images, category, inventoryCount } = req.body;

    product.title = title || product.title;
    product.description = description || product.description;
    product.images = images || product.images;
    product.category = category || product.category;
    product.inventoryCount = inventoryCount || product.inventoryCount;

    const updatedProduct = await product.save();

    res.json({
      message: "product updated successfully",
      product: updatedProduct,
    });
  } catch (err) {
    console.log("Error Updataing Product", err.message);
    res.json({ message: "Server Error" });
  }
};

/**
 * @desc Delete product (Seller only)
 * @route DELETE /api/products/:id
 * @access Private
 */

export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(403).json({ message: "product Not Found" });
    }

    // authorization

    if (product.seller.toString() !== req.user._id.toString()) {
      return res
        .json(403)
        .json({ message: "Not authorized to delete this product" });
    }

    await product.deleteOne();
    res.json({ message: "product deleted successfully" });
  } catch (err) {
    console.error("❌ Error deleting product:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};
