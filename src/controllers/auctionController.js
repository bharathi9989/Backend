import Auction from "../models/Auction.js";
import Product from "../models/Product.js";
import Bid from "../models/Bid.js";

/**
 * Create auction - seller only
 */
export const createAuction = async (req, res, next) => {
  try {
    if (req.user.role !== "seller")
      return res
        .status(403)
        .json({ message: "Only seller can create auctions" });

    const { productId, type, startPrice, minIncrement, startAt, endAt } =
      req.body;
    if (
      !productId ||
      !type ||
      startPrice == null ||
      minIncrement == null ||
      !startAt ||
      !endAt
    ) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const start = new Date(startAt);
    const end = new Date(endAt);
    if (isNaN(start.getTime()) || isNaN(end.getTime()))
      return res.status(400).json({ message: "Invalid dates" });
    if (end <= start)
      return res.status(400).json({ message: "endAt must be after startAt" });

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: "Product not found" });
    if (!product.seller.equals(req.user._id))
      return res
        .status(403)
        .json({ message: "You can only auction your own product" });
    if (product.inventoryCount <= 0)
      return res.status(400).json({ message: "Product not in stock" });

    const status = start > new Date() ? "upcoming" : "live";

    const auction = await Auction.create({
      product: productId,
      seller: req.user._id,
      type,
      startPrice,
      minIncrement,
      startAt: start,
      endAt: end,
      status,
    });

    res.status(201).json({ message: "Auction created", auction });
  } catch (err) {
    next(err);
  }
};

// controllers/auctionController.js

export const getAllAuctions = async (req, res) => {
  try {
    const { status, category, page = 1, limit = 9, sort } = req.query;

    const query = {};

    // status filter
    if (status === "live") {
      query.startAt = { $lte: new Date() };
      query.endAt = { $gte: new Date() };
    } else if (status === "upcoming") {
      query.startAt = { $gt: new Date() };
    } else if (status === "ended") {
      query.endAt = { $lt: new Date() };
    }

    // category filter
    if (category) {
      query.category = category;
    }

    // sorting
    let sortQuery = {};
    if (sort === "price_high") sortQuery.startPrice = -1;
    if (sort === "price_low") sortQuery.startPrice = 1;
    if (sort === "ending_soon") sortQuery.endAt = 1;
    if (sort === "newest") sortQuery.createdAt = -1;

    const skip = (page - 1) * limit;

    const auctions = await Auction.find(query)
      .populate("product")
      .populate("seller", "name")
      .sort(sortQuery)
      .skip(skip)
      .limit(Number(limit));

    const total = await Auction.countDocuments(query);

    res.json({
      auctions,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    res.status(500).json({ message: "Error loading auctions" });
  }
};

export const getAuctionById = async (req, res, next) => {
  try {
    const auction = await Auction.findById(req.params.id)
      .populate("product")
      .populate("seller", "name email");
    if (!auction) return res.status(404).json({ message: "Auction not found" });

    // determine what bids to reveal
    let bids = [];
    if (auction.type === "sealed" && auction.status !== "closed") {
      bids = []; // sealed and live: hide bids
    } else {
      bids = await Bid.find({ auction: auction._id })
        .populate("bidder", "name email")
        .sort({ amount: -1 });
    }

    res.json({ auction, bids });
  } catch (err) {
    next(err);
  }
};

export const updateAuctionStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const auction = await Auction.findById(req.params.id).populate(
      "product",
      "title description images category inventoryCount"
    );
    if (!auction) return res.status(404).json({ message: "Auction not found" });
    if (!auction.seller.equals(req.user._id))
      return res.status(403).json({ message: "Not authorized" });

    auction.status = status;
    await auction.save();
    res.json({ message: "Auction status updated", auction });
  } catch (err) {
    next(err);
  }
};
