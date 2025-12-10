import Bid from "../models/Bid.js";
import Auction from "../models/Auction.js";
import User from "../models/User.js";

export const getBuyerSummary = async (req, res) => {
  const userId = req.user._id;

  const totalBids = await Bid.countDocuments({ bidder: userId });

  const bids = await Bid.find({ bidder: userId }).populate({
    path: "auction",
    populate: { path: "product", select: "title images category" },
  });

  // Categorize
  let won = 0;
  let lost = 0;
  let active = 0;
  let upcoming = 0;

  for (const b of bids) {
    const a = b.auction;
    if (!a) continue;

    if (a.status === "live") active++;
    else if (a.status === "upcoming") upcoming++;
    else if (a.status === "closed") {
      if (a.winnerBid?.toString() === b._id.toString()) won++;
      else lost++;
    }
  }

  // recent bids
  const recent = bids
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);

  res.json({
    totalBids,
    won,
    lost,
    active,
    upcoming,
    recent,
  });
};
export const updateProfile = async (req, res) => {
  const user = req.user;

  const { name, email, password } = req.body;

  if (name) user.name = name;
  if (email) user.email = email;
  if (password) user.password = password; // hashing middleware will run

  await user.save();

  res.json({ message: "Profile updated", user });
};

export const updateNotifications = async (req, res) => {
  try {
    const userId = req.user._id;
    const { outbid, win, auctionStart, auctionEnd } = req.body;

    const user = await User.findByIdAndUpdate(
      userId,
      {
        notificationSettings: {
          outbid,
          win,
          auctionStart,
          auctionEnd,
        },
      },
      { new: true }
    );

    res.json({
      message: "Notification settings updated",
      settings: user.notificationSettings,
    });
  } catch (err) {
    res.status(500).json({ message: "Error updating settings" });
  }
};