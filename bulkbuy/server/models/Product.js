const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    retailPrice: { type: Number, required: true, min: 0 },
    groupPrice: { type: Number, required: true, min: 0 },
    targetBuyers: { type: Number, required: true, min: 1 },
    joinedBuyers: { type: Number, default: 0, min: 0 },
    category: { type: String, default: "General" },
    image: { type: String, default: "" },
    status: {
      type: String,
      enum: ["active", "successful", "expired"],
      default: "active",
    },
    deadline: {
      type: Date,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Default 7 days from creation
    },
    joinedUsers: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Customer",
        },
        joinedAt: {
          type: Date,
          default: Date.now,
        },
        quantity: {
          type: Number,
          default: 1,
        },
      },
    ],
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.Product || mongoose.model("Product", productSchema);
