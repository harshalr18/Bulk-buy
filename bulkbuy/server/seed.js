require("dotenv").config();

const mongoose = require("mongoose");
const Product = require("./models/Product");

const sampleProducts = [
  {
    name: "Wireless Noise-Canceling Headphones",
    description:
      "High-fidelity audio with active noise cancellation, 30-hour battery life, and ultra-comfortable ear cushions for work and travel.",
    retailPrice: 2999,
    groupPrice: 1999,
    targetBuyers: 8,
    joinedBuyers: 5,
    category: "Electronics",
    image:
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80",
    status: "active",
    deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
  },
  {
    name: "Mechanical Gaming Keyboard RGB",
    description:
      "Tactile mechanical switches with customizable RGB lighting per key, anti-ghosting, and ergonomic aluminum wrist rest.",
    retailPrice: 4499,
    groupPrice: 3199,
    targetBuyers: 10,
    joinedBuyers: 7,
    category: "Electronics",
    image:
      "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&q=80",
    status: "active",
    deadline: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
  },
  {
    name: "Ergonomic Mesh Study & Office Chair",
    description:
      "Breathable high-density mesh with adjustable lumbar support, 3D armrests, and smooth silent caster wheels.",
    retailPrice: 8999,
    groupPrice: 6299,
    targetBuyers: 6,
    joinedBuyers: 4,
    category: "Home & Furniture",
    image:
      "https://images.unsplash.com/photo-1580481077195-c9447477c77a?w=800&q=80",
    status: "active",
    deadline: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
  },
  {
    name: "Smart Fitness Watch with AMOLED Display",
    description:
      "Water-resistant fitness tracker with heart rate, SpO2 monitoring, 100+ workout modes, and built-in GPS.",
    retailPrice: 3499,
    groupPrice: 2399,
    targetBuyers: 12,
    joinedBuyers: 11,
    category: "Wearables",
    image:
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80",
    status: "active",
    deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
  },
  {
    name: "Waterproof Travel & College Backpack",
    description:
      "Large 35L capacity with dedicated padded laptop compartment, USB charging port, and water-repellent oxford fabric.",
    retailPrice: 1999,
    groupPrice: 1299,
    targetBuyers: 15,
    joinedBuyers: 15,
    category: "Fashion & Bags",
    image:
      "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=80",
    status: "successful",
    deadline: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
  },
  {
    name: "All-Terrain Mountain Bicycle 21-Speed",
    description:
      "Lightweight alloy frame, dual disc brakes, front suspension fork, and Shimano 21-speed gear system for city & trail.",
    retailPrice: 14999,
    groupPrice: 11499,
    targetBuyers: 5,
    joinedBuyers: 2,
    category: "Sports & Fitness",
    image:
      "https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=800&q=80",
    status: "active",
    deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  },
  {
    name: "Stainless Steel Thermal Coffee Tumbler 500ml",
    description:
      "Double-walled vacuum insulated mug that keeps drinks hot for 8 hours or iced for 16 hours. Leak-proof flip lid.",
    retailPrice: 999,
    groupPrice: 599,
    targetBuyers: 20,
    joinedBuyers: 14,
    category: "Kitchen & Dining",
    image:
      "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&q=80",
    status: "active",
    deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
  },
  {
    name: "Ultra-Lightweight Pro Running Shoes",
    description:
      "Responsive foam cushioning, breathable knit upper, and anti-slip traction outsole engineered for marathon runs.",
    retailPrice: 3999,
    groupPrice: 2699,
    targetBuyers: 10,
    joinedBuyers: 6,
    category: "Footwear",
    image:
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80",
    status: "active",
    deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
  },
];

async function seedDatabase() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is missing. Configure it in server/.env.");
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB for seeding...");

    const operations = sampleProducts.map((prod) => ({
      updateOne: {
        filter: { name: prod.name },
        update: {
          $setOnInsert: {
            ...prod,
            joinedUsers: [],
          },
        },
        upsert: true,
      },
    }));

    const result = await Product.bulkWrite(operations);
    console.log(
      `Seed complete: ${result.upsertedCount} new products added; existing products preserved.`
    );
  } finally {
    await mongoose.disconnect();
  }
}

seedDatabase().catch((error) => {
  console.error("Seeding failed:", error.message);
  process.exitCode = 1;
});
