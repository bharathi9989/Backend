import Product from "../model/Product.js";
import Auction from "../model/Auction.js";

export const createAuction = async (req, res) => {
  try {
    // Only seller can create

    if (req.user.role !== "seller") {
      return res
        .status(403)
        .json({ message: "only seller can create this auction" });
    }

    // validations

    const { productId, type, startPrice, minIncrement, startAt, endAt } =
      req.body;
    console.log(req.body);

    // 1️⃣ Check if product exists and belongs to this seller
    if (
      !productId ||
      !type ||
      startPrice == null ||
      !minIncrement ||
      !startAt ||
      !endAt
    ) {
      return res.status(400).json({ message: "Missing Required Fields" });
    }
    if (startPrice < 0 || minIncrement <= 0) {
      return res.status(400).json({ message: "Invalid Price or Increment" });
    }

    const start = new Date(startAt);
    const end = new Date(endAt);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ message: "Invalid Dates" });
    }
    if (end <= start) {
      return res.status(400).json({ message: "endAt must be after startAt" });
    }

    // Check if product exists

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(403).json({ message: " Product Not Found" });
    }
    if (product.seller.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "you can only auction your own product" });
    }

    // 2️⃣ Create auction entry

    const auction = await Auction.create({
      product: productId,
      seller: req.user._id,
      type,
      startPrice,
      minIncrement,
      startAt,
      endAt,
      status: new Date(startAt) > new Date() ? "upcoming" : "live",
    });

    res.status(201).json({ message: "Auction created successfully", auction });
  } catch (err) {
    console.error("❌ Error creating auction:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * @desc Get all auctions
 * @route GET /api/auctions
 * @access Public
 */

export const getAllAuctions = async (req, res) => {
  try {
    const auctions = await Auction.find()
      .populate("product", "title category ")
      .populate("seller", "name email");
    res.json(auctions);
  } catch (err) {
    console.error("❌ Error fetching auctions:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * @desc Get single auction by ID
 * @route GET /api/auctions/:id
 * @access Public
 */

export const getAuctionById = async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id)
      .populate("product", "title description category")
      .populate("seller", "name email");
    if (!auction) {
      return res.status(403).json({ message: "Auction Not Found" });
    }
    res.json(auction);
  } catch (err) {
    console.error("❌ Error fetching auction:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * @desc Update auction status (seller only)
 * @route PUT /api/auctions/:id/status
 * @access Private
 */

export const updateAuctionStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const auction = await Auction.findById(req.params.id);
    if (!auction) {
      return res.status(403).json({ message: "Auction Not Found" });
    }
    if (auction.seller.toString() !== req.user._id.toString()) {
      return res
        .send(403)
        .json({ message: "Not authorized to update this auction" });
    }

    auction.status = status;
    await auction.save();

    res.json({
      message: "Auction status updated successfully",
      auction,
    });
  } catch (err) {
    console.error("❌ Error updating auction:", error);
    res.status(500).json({ message: "Server error" });
  }
};
