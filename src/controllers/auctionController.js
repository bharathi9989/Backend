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
    // Search
    if (req.query.q) {
      const q = req.query.q.trim();
      query["product.title"] = { $regex: q, $options: "i" };
    }
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

/**
 * GET /auctions
 * Supports:
 * - Search (q)
 * - Filters: status, type, category
 * - Sort: newest, endingSoon, priceAsc, priceDesc
 * - Pagination
 * - my=true → seller's own auctions
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
    const mongoQuery = {};
    const skip = (page - 1) * limit;

    /** --------------------------
     * 1. MY AUCTIONS (PRIVATE)
     --------------------------- */
    if (my === "true" && req.user) {
      mongoQuery.seller = req.user._id;
    }

    /** --------------------------
     * 2. STATUS FILTERS
     --------------------------- */
    if (status === "live") {
      mongoQuery.startAt = { $lte: now };
      mongoQuery.endAt = { $gte: now };
      mongoQuery.status = { $ne: "closed" };
    } else if (status === "upcoming") {
      mongoQuery.startAt = { $gt: now };
    } else if (status === "closed") {
      mongoQuery.status = "closed";
    }

    /** --------------------------
     * 3. TYPE FILTER
     --------------------------- */
    if (type) mongoQuery.type = type;

    /** --------------------------
     * 4. CATEGORY FILTER
     --------------------------- */
    if (category) {
      mongoQuery["product.category"] = category;
    }

    /** --------------------------
     * 5. 🔍 SEARCH FILTER (SDE-3 logic)
     * Search inside:
     *   - product.title
     *   - product.description
     *   - product.category
     --------------------------- */
    let searchStage = {};
    if (q) {
      const regex = new RegExp(q, "i");
      searchStage = {
        $or: [
          { "product.title": regex },
          { "product.description": regex },
          { "product.category": regex },
        ],
      };
    }

    /** --------------------------
     * 6. AGGREGATION PIPELINE (Amazon-grade)
     --------------------------- */
    const pipeline = [
      { $lookup: {
          from: "products",
          localField: "product",
          foreignField: "_id",
          as: "product",
        }
      },
      { $unwind: "$product" },

      { $match: mongoQuery },

      ...(q ? [{ $match: searchStage }] : []),

      { $sort: buildSort(sort) },

      { $facet: {
          data: [
            { $skip: skip },
            { $limit: Number(limit) }
          ],
          total: [{ $count: "count" }]
      }}
    ];

    const result = await Auction.aggregate(pipeline);

    const auctions = result[0].data;
    const total =
      result[0].total.length > 0 ? result[0].total[0].count : 0;

    return res.json({
      auctions,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.log("Auction search error:", err);
    res.status(500).json({ message: "Error loading auctions" });
  }
};

/** Sorting helper */
function buildSort(sort) {
  if (sort === "newest") return { createdAt: -1 };
  if (sort === "endingSoon") return { endAt: 1 };
  if (sort === "priceAsc") return { startPrice: 1 };
  if (sort === "priceDesc") return { startPrice: -1 };
  return { createdAt: -1 };
}

function sortAuction(sort) {
  if (sort === "priceAsc") return { startPrice: 1 };
  if (sort === "priceDesc") return { startPrice: -1 };
  if (sort === "endingSoon") return { endAt: 1 };
  if (sort === "newest") return { createdAt: -1 };
  return {};
}
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

// CLOSE AUCTION IMMEDIATELY (Seller Only)
// CLOSE AUCTION IMMEDIATELY (Seller Only)
/**
 * CLOSE AUCTION IMMEDIATELY (Seller Only) — SDE-3 Clean Version
 */
export const closeAuctionNow = async (req, res) => {
  try {
    const auctionId = req.params.id;

    // Load auction fully
    const auction = await Auction.findById(auctionId)
      .populate("product")
      .populate("seller")
      .exec();

    if (!auction)
      return res.status(404).json({ message: "Auction not found" });

    // Authorization check
    if (!auction.seller._id.equals(req.user._id)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // Already closed?
    if (auction.status === "closed") {
      return res.status(400).json({ message: "Auction already closed" });
    }

    // Validate product reference
    const product = auction.product;
    if (!product) {
      return res.status(500).json({
        message: "Product missing in auction. Cannot close."
      });
    }

    /**
     * Winner Logic
     * - Traditional + Sealed → highest bid wins
     * - Reverse → lowest bid wins
     */
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

    /**
     * Update Auction Status
     */
    auction.status = "closed";
    auction.winnerBid = winnerBid ? winnerBid._id : null;

    /**
     * Update Product Inventory (ZERO BUG Logic)
     */
    if (winnerBid) {
      // Someone won → reduce inventory
      product.inventoryCount = Math.max(0, product.inventoryCount - 1);

      // If inventory is zero → mark as sold
      product.status = product.inventoryCount === 0 ? "sold" : "active";
    } else {
      // No bids → product usable for re-auction
      product.status = "unsold";
    }

    await product.save();
    await auction.save();

    /**
     * Send Emails (Protected)
     */
    try {
      // Seller email
      if (auction.seller?.email) {
        await sendMail(
          auction.seller.email,
          `Auction Closed: ${product.title}`,
          `
            <p>Your auction has been closed manually.</p>
            ${
              winnerBid
                ? `<p>Winner: ${winnerBid.bidder.name} — ₹${winnerBid.amount}</p>`
                : `<p>No bids were placed.</p>`
            }
          `
        );
      }

      // Winner email
      if (winnerBid?.bidder?.email) {
        await sendMail(
          winnerBid.bidder.email,
          `You won the auction: ${product.title}`,
          `<p>You won with a bid of ₹${winnerBid.amount}.</p>`
        );
      }
    } catch (err) {
      console.log("Email sending failed:", err.message);
    }

    /**
     * Emit Socket Event
     */
    try {
      if (global.io) {
        global.io.to(`auction:${auctionId}`).emit("auctionClosed", {
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
    } catch (err) {
      console.log("Socket emit failed:", err.message);
    }

    return res.json({
      message: "Auction closed successfully",
      winner: winnerBid ? winnerBid.bidder.name : null,
    });

  } catch (err) {
    console.log("closeAuctionNow ERROR:", err);
    return res.status(500).json({ message: "Error closing auction" });
  }
};

export const relistProduct = async (req, res) => {
  try {
    const { productId, startPrice, minIncrement, startAt, endAt, type } =
      req.body;

    // Validate input
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

    // Must belong to seller
    if (!product.seller.equals(req.user._id))
      return res.status(403).json({ message: "Not your product" });

    // Must be UNSOLD
    if (product.status !== "unsold")
      return res.status(400).json({ message: "Product is not unsold" });

    const start = new Date(startAt);
    const end = new Date(endAt);

    if (isNaN(start) || isNaN(end))
      return res.status(400).json({ message: "Invalid dates" });
    if (end <= start)
      return res.status(400).json({ message: "endAt must be after startAt" });

    // Determine auction status
    const status = start > new Date() ? "upcoming" : "live";

    // Create new auction
    const newAuction = await Auction.create({
      product: productId,
      seller: req.user._id,
      type,
      startPrice,
      minIncrement,
      startAt,
      endAt,
      status,
    });

    // Product goes back to "available / listed" state
    product.status = "unsold"; // still unsold but available for re-auction
    await product.save();

    res.json({
      message: "Product re-listed successfully",
      auction: newAuction,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Failed to re-list product" });
  }
};
