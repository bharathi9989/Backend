import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    images: { type: [String], default: [] },
    category: { type: String, required: true },
    inventoryCount: { type: Number, default: 1, min: 0 },
    status: {
      type: String,
      enum: ["active", "sold", "unsold", "draft"],
      default: "active",
    },
  },
  { timestamps: true }
);

const Product =
  mongoose.models.Product || mongoose.model("Product", productSchema);
  productSchema.index({ title: "text", description: "text", category: "text" });
export default Product;
