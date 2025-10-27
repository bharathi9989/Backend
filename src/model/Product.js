/**
 * Product schema for auction items
 * - seller: reference to the user who created it
 * - title: product title
 * - description: brief details
 * - images: array of image URLs
 * - category: product category
 * - inventoryCount: available quantity
 * - createdAt: timestamp
 */

import mongoose, { model, Schema } from "mongoose";

const productSchema = Schema(
  {
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: { type: String, required: true },
    description: { type: String },
    images: [String],
    category: { type: String, required: true },
    inventoryCount: { type: Number, default: 1 },
  },
  { timestamps: true }
);

const Product =
  mongoose.models.Product || mongoose.model("Product", productSchema);

export default Product;
