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

export const getAllAuctions = async (req, res, next) => {
  try {
    const auctions = await Auction.find()
      .populate("product", "title category")
      .populate("seller", "name email");
    res.json(auctions);
  } catch (err) {
    next(err);
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
    const auction = await Auction.findById(req.params.id);
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
