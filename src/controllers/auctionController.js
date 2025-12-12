// src/controllers/auctionController.js
import Auction from "../models/Auction.js";
import Product from "../models/Product.js";
import Bid from "../models/Bid.js";
import { sendMail } from "../utils/mailer.js";
import { getIO } from "../socket.js";

/**
 * createAuction
 * - Seller only
 */
export const createAuction = async (req, res, next) => {
  try {
    if (!req.user || req.user.role !== "seller")
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
    if ((product.inventoryCount ?? 0) <= 0)
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

    return res.status(201).json({ message: "Auction created", auction });
  } catch (err) {
    next(err);
  }
};

/**
 * getAllAuctions (Aggregation pipeline)
 * - supports q, status, type, category, sort, pagination, my=true
 */
export const getAllAuctions = async (req, res) => {
  try {
    const {
      q,
      status,
      type,
      category,
      page = 1,
      limit = 12,
      sort,
      my,
    } = req.query;
    const now = new Date();
    const skip = (Math.max(Number(page), 1) - 1) * Number(limit);
    const mongoMatch = {};

    // my auctions (requires auth)
    if (my === "true" && req.user) mongoMatch.seller = req.user._id;

    // status mapping
    if (status === "live") {
      mongoMatch.startAt = { $lte: now };
      mongoMatch.endAt = { $gte: now };
      mongoMatch.status = { $ne: "closed" };
    } else if (status === "upcoming") {
      mongoMatch.startAt = { $gt: now };
    } else if (status === "closed") {
      mongoMatch.status = "closed";
    }

    if (type) mongoMatch.type = type;
    // category will be matched after lookup on product.category (case-insensitive)
    const pipeline = [
      // join product
      {
        $lookup: {
          from: "products",
          localField: "product",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },

      // initial match (seller, status, type)
      { $match: mongoMatch },
    ];

    // q search across product.title, description, category
    if (q && q.trim()) {
      const re = new RegExp(q.trim(), "i");
      pipeline.push({
        $match: {
          $or: [
            { "product.title": re },
            { "product.description": re },
            { "product.category": re },
          ],
        },
      });
    }

    // category filter (case-insensitive)
    if (category) {
      pipeline.push({
        $match: { "product.category": new RegExp(`^${category}$`, "i") },
      });
    }

    // sort stage
    pipeline.push({ $sort: buildSort(sort) });

    // pagination + total using facet
    pipeline.push({
      $facet: {
        data: [{ $skip: Number(skip) }, { $limit: Number(limit) }],
        total: [{ $count: "count" }],
      },
    });

    const agg = await Auction.aggregate(pipeline);
    const auctions = (agg[0] && agg[0].data) || [];
    const total =
      (agg[0] && agg[0].total && agg[0].total[0] && agg[0].total[0].count) || 0;

    return res.json({
      auctions,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
    });
  } catch (err) {
    console.error("Auction search error:", err);
    return res.status(500).json({ message: "Error loading auctions" });
  }
};

function buildSort(sort) {
  if (sort === "newest") return { createdAt: -1 };
  if (sort === "endingSoon") return { endAt: 1 };
  if (sort === "priceAsc") return { startPrice: 1 };
  if (sort === "priceDesc") return { startPrice: -1 };
  return { createdAt: -1 };
}

/**
 * getAuctionById
 * - returns auction + visible bids (sealed auctions hide bids until closed)
 */
export const getAuctionById = async (req, res, next) => {
  try {
    const auction = await Auction.findById(req.params.id)
      .populate("product")
      .populate("seller", "name email");
    if (!auction) return res.status(404).json({ message: "Auction not found" });

    let bids = [];
    if (auction.type === "sealed" && auction.status !== "closed") {
      bids = []; // hide
    } else {
      bids = await Bid.find({ auction: auction._id })
        .populate("bidder", "name email")
        .sort({ amount: -1 });
    }

    return res.json({ auction, bids });
  } catch (err) {
    next(err);
  }
};

/**
 * updateAuctionStatus (seller only)
 */
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
    return res.json({ message: "Auction status updated", auction });
  } catch (err) {
    next(err);
  }
};

/**
 * closeAuctionNow (seller only) - SDE-3 robust
 */
export const closeAuctionNow = async (req, res) => {
  try {
    const auctionId = req.params.id;
    const auction = await Auction.findById(auctionId)
      .populate("product")
      .populate("seller")
      .exec();
    if (!auction) return res.status(404).json({ message: "Auction not found" });

    if (!auction.seller._id.equals(req.user._id))
      return res.status(403).json({ message: "Not authorized" });
    if (auction.status === "closed")
      return res.status(400).json({ message: "Auction already closed" });

    const product = auction.product;
    if (!product)
      return res.status(500).json({ message: "Product missing in auction" });

    // pick winner
    let winnerBid = null;
    if (auction.type === "reverse") {
      winnerBid = await Bid.findOne({ auction: auctionId })
        .sort({ amount: 1 })
        .populate("bidder");
    } else {
      winnerBid = await Bid.findOne({ auction: auctionId })
        .sort({ amount: -1 })
        .populate("bidder");
    }

    // update auction + product (atomic not required here but ensure correct order)
    auction.status = "closed";
    auction.winnerBid = winnerBid ? winnerBid._id : null;

    if (winnerBid) {
      product.inventoryCount = Math.max(0, (product.inventoryCount || 0) - 1);
      product.status = product.inventoryCount === 0 ? "sold" : "active";
    } else {
      product.status = "unsold";
    }

    await product.save();
    await auction.save();

    // emails (best-effort)
    try {
      if (auction.seller?.email) {
        await sendMail(
          auction.seller.email,
          `Auction Closed: ${product.title}`,
          `<p>Your auction has been closed.</p>${
            winnerBid
              ? `<p>Winner: ${winnerBid.bidder.name} — ₹${winnerBid.amount}</p>`
              : `<p>No bids placed.</p>`
          }`
        );
      }
      if (winnerBid?.bidder?.email) {
        await sendMail(
          winnerBid.bidder.email,
          `You won the auction: ${product.title}`,
          `<p>You won with a bid of ₹${winnerBid.amount}.</p>`
        );
      }
    } catch (emailErr) {
      console.error("Email error:", emailErr.message);
    }

    // socket emit (best-effort)
    try {
      const io = getIO();
      if (io) {
        io.to(`auction:${auctionId}`).emit("auctionClosed", {
          auctionId,
          closedBy: "seller",
          winner: winnerBid
            ? {
                id: winnerBid.bidder._id,
                name: winnerBid.bidder.name,
                amount: winnerBid.amount,
              }
            : null,
        });
      }
    } catch (emitErr) {
      console.error("Socket emit failed:", emitErr.message);
    }

    return res.json({
      message: "Auction closed successfully",
      winner: winnerBid ? winnerBid.bidder.name : null,
    });
  } catch (err) {
    console.error("closeAuctionNow ERROR:", err);
    return res.status(500).json({ message: "Error closing auction" });
  }
};

/**
 * relistProduct
 */
export const relistProduct = async (req, res) => {
  try {
    const { productId, startPrice, minIncrement, startAt, endAt, type } =
      req.body;
    if (
      !productId ||
      !startPrice ||
      !minIncrement ||
      !startAt ||
      !endAt ||
      !type
    )
      return res.status(400).json({ message: "Missing required fields" });

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: "Product not found" });
    if (!product.seller.equals(req.user._id))
      return res.status(403).json({ message: "Not your product" });
    if (product.status !== "unsold")
      return res.status(400).json({ message: "Product is not unsold" });

    const start = new Date(startAt);
    const end = new Date(endAt);
    if (isNaN(start) || isNaN(end))
      return res.status(400).json({ message: "Invalid dates" });
    if (end <= start)
      return res.status(400).json({ message: "endAt must be after startAt" });

    const status = start > new Date() ? "upcoming" : "live";

    const newAuction = await Auction.create({
      product: productId,
      seller: req.user._id,
      type,
      startPrice,
      minIncrement,
      startAt: start,
      endAt: end,
      status,
    });

    product.status = "unsold";
    await product.save();

    return res.json({
      message: "Product re-listed successfully",
      auction: newAuction,
    });
  } catch (err) {
    console.error("relistProduct error:", err);
    return res.status(500).json({ message: "Failed to re-list product" });
  }
};
