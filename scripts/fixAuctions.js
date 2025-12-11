// scripts/fixAuctions.js
import mongoose from "mongoose";
import Auction from "../src/models/Auction.js";
import Product from "../src/models/Product.js";

const MONGO_URI =
  "mongodb+srv://ervelubharathis_db_user:bVAj4wjaxCVqnCC5@auction.s5b0nzm.mongodb.net/auctionPlatform?retryWrites=true&w=majority&appName=Auction"; 

async function fixBrokenAuctions() {
  await mongoose.connect(MONGO_URI);
  console.log("🔥 Connected to database");

  const auctions = await Auction.find().lean();

  let fixed = 0;
  let createdProducts = 0;

  for (const auction of auctions) {
    const productId = auction.product;

    // 1. Case: product field missing OR null
    if (!productId) {
      console.log(`⚠️ Auction ${auction._id} has NO product field, fixing...`);

      const newProduct = await Product.create({
        seller: auction.seller,
        title: "Recovered Product",
        description: "Auto-created because original product was missing",
        images: [],
        category: "Unknown",
        inventoryCount: 1,
        status: "unsold",
      });

      await Auction.updateOne(
        { _id: auction._id },
        { $set: { product: newProduct._id } }
      );

      createdProducts++;
      fixed++;
      continue;
    }

    // 2. Case: productId exists, but product document doesn't
    const prodExists = await Product.findById(productId).lean();
    if (!prodExists) {
      console.log(
        `⚠️ Auction ${auction._id} refers to deleted product ${productId}, restoring...`
      );

      const newProduct = await Product.create({
        seller: auction.seller,
        title: "Recovered Product (Missing Original)",
        description: "Auto-created because referenced product was deleted",
        images: [],
        category: "Unknown",
        inventoryCount: 1,
        status: "unsold",
      });

      await Auction.updateOne(
        { _id: auction._id },
        { $set: { product: newProduct._id } }
      );

      createdProducts++;
      fixed++;
    }
  }

  console.log("---------------------------------------------------");
  console.log(`✅ FIX COMPLETE`);
  console.log(`📌 Auctions repaired: ${fixed}`);
  console.log(`📌 New placeholder products created: ${createdProducts}`);
  console.log("---------------------------------------------------");

  process.exit(0);
}

fixBrokenAuctions().catch((err) => {
  console.error(err);
  process.exit(1);
});
