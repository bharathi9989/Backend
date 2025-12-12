// src/controllers/bidHistoryController.js
import Bid from "../models/Bid.js";
import Auction from "../models/Auction.js";

/**
 * getMyBids
 * returns paginated bids with outcome (won/lost/pending)
 */
export const getMyBids = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Number(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const [total, bids] = await Promise.all([
      Bid.countDocuments({ bidder: userId }),
      Bid.find({ bidder: userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({
          path: "auction",
          populate: { path: "product", select: "title images category" },
        })
        .populate("bidder", "name email"),
    ]);

    // Compute outcome
    const bidsWithStatus = await Promise.all(
      bids.map(async (b) => {
        const auction = b.auction;
        let outcome = "pending";
        if (!auction) {
          outcome = "pending";
        } else if (auction.status !== "closed") {
          outcome = "pending";
        } else {
          // If auction has winnerBid set, compare to this bid's id
          if (auction.winnerBid) {
            outcome =
              auction.winnerBid.toString() === b._id.toString()
                ? "won"
                : "lost";
          } else {
            // fallback compute winner from DB
            try {
              const winner =
                auction.type === "reverse"
                  ? await Bid.findOne({ auction: auction._id })
                      .sort({ amount: 1 })
                      .limit(1)
                  : await Bid.findOne({ auction: auction._id })
                      .sort({ amount: -1 })
                      .limit(1);
              outcome =
                winner && winner._id.toString() === b._id.toString()
                  ? "won"
                  : "lost";
            } catch {
              outcome = "pending";
            }
          }
        }

        return {
          _id: b._id,
          amount: b.amount,
          sealed: b.sealed,
          createdAt: b.createdAt,
          auction: {
            _id: auction?._id,
            type: auction?.type,
            status: auction?.status,
            startAt: auction?.startAt,
            endAt: auction?.endAt,
            startPrice: auction?.startPrice,
            minIncrement: auction?.minIncrement,
            product: auction?.product || null,
          },
          outcome,
        };
      })
    );

    return res.json({
      bids: bidsWithStatus,
      page,
      totalPages: Math.ceil(total / limit),
      total,
    });
  } catch (err) {
    next(err);
  }
};
