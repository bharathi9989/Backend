// src/controllers/bidHistoryController.js
import Bid from "../models/Bid.js";
import Auction from "../models/Auction.js";

/**
 * GET /api/bids/my
 * Query params:
 *  - page (optional), limit (optional)
 *
 * Response: { bids: [...], page, totalPages, total }
 */
export const getMyBids = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Number(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    // Fetch bids by user with auction & product populated
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

    // Compute outcome per bid (won/lost/pending) without heavy DB calls
    // For an auction that is closed and has winnerBid set — compare id
    const bidsWithStatus = await Promise.all(
      bids.map(async (b) => {
        const auction = b.auction;
        let outcome = "pending";

        if (!auction) {
          outcome = "pending";
        } else if (auction.status !== "closed") {
          outcome = "pending";
        } else {
          // auction closed - determine winner
          // prefer explicit winnerBid field (if you set it in scheduler)
          if (auction.winnerBid) {
            // winnerBid may be ObjectId
            outcome =
              auction.winnerBid.toString() === b._id.toString() ||
              auction.winnerBid.toString() === b._id?.toString()
                ? "won"
                : b.bidder && auction.winnerBid.toString() === b._id?.toString()
                ? "won"
                : auction.winnerBid.toString() === b._id?.toString()
                ? "won"
                : "lost";

            // But winnerBid may refer to bid._id — compare bid._id
            if (auction.winnerBid.toString() === b._id.toString())
              outcome = "won";
            else outcome = "lost";
          } else {
            // fallback: compute from DB (safe)
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
            } catch (e) {
              // fallback to pending if something odd
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

    res.json({
      bids: bidsWithStatus,
      page,
      totalPages: Math.ceil(total / limit),
      total,
    });
  } catch (err) {
    next(err);
  }
};
