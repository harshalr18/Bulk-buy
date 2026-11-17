const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const dns = require("dns");
require("dotenv").config();

// Use reliable public DNS servers (Google & Cloudflare) to prevent querySrv ECONNREFUSED
try {
  dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
} catch (_dnsErr) {
  // Ignore in sandboxed or restricted environments
}

const Product = require("./models/Product");
const Admin = require("./models/Admin");
const Customer = require("./models/Customer");
const Order = require("./models/Order");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Environment variables
const PORT = process.env.PORT || 5001;
const MONGODB_URI = process.env.MONGODB_URI;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const JWT_SECRET = process.env.JWT_SECRET;

// Check required environment variables
function checkEnvironment() {
  const missing = [];

  if (!MONGODB_URI) missing.push("MONGODB_URI");
  if (!ADMIN_EMAIL) missing.push("ADMIN_EMAIL");
  if (!ADMIN_PASSWORD) missing.push("ADMIN_PASSWORD");
  if (!JWT_SECRET) missing.push("JWT_SECRET");

  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(", ")}`);
  }
}

// Create admin account or synchronize its password with .env
async function createAdmin() {
  const email = ADMIN_EMAIL.toLowerCase().trim();

  let admin = await Admin.findOne({ email });

  if (!admin) {
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12);

    admin = await Admin.create({
      email,
      password: hashedPassword,
    });

    console.log("Admin account created successfully!");
    return;
  }

  const passwordMatches = await bcrypt.compare(ADMIN_PASSWORD, admin.password);

  if (!passwordMatches) {
    admin.password = await bcrypt.hash(ADMIN_PASSWORD, 12);
    await admin.save();
    console.log("Admin password synchronized with .env!");
  } else {
    console.log("Admin account verified.");
  }
}

// ==========================================
// AUTHENTICATION MIDDLEWARES
// ==========================================

// Admin authentication middleware
function verifyAdmin(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Access denied. Please log in as admin.",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.role !== "admin") {
      return res.status(403).json({
        message: "Admin access required.",
      });
    }

    req.admin = decoded;
    next();
  } catch (_error) {
    return res.status(401).json({
      message: "Invalid or expired admin token. Please log in again.",
    });
  }
}

// Customer authentication middleware
function verifyCustomer(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Authentication required. Please log in to your account.",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.role !== "customer") {
      return res.status(403).json({
        message: "Customer access required.",
      });
    }

    req.customer = decoded;
    next();
  } catch (_error) {
    return res.status(401).json({
      message: "Invalid or expired session. Please log in again.",
    });
  }
}

// Optional customer extraction middleware (does not fail if not authenticated)
function extractCustomer(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    try {
      const decoded = jwt.verify(authHeader.split(" ")[1], JWT_SECRET);
      if (decoded.role === "customer") {
        req.customer = decoded;
      }
    } catch {
      // Ignore token parse errors for public routes
    }
  }
  next();
}

// ==========================================
// HELPER: AUTO-CREATE ORDERS ON DEAL SUCCESS
// ==========================================

async function autoCreateOrdersForDeal(product) {
  try {
    if (!product || !product.joinedUsers || product.joinedUsers.length === 0) {
      return;
    }

    const retailPrice = Number(product.retailPrice) || 0;
    const groupPrice = Number(product.groupPrice) || 0;
    const savingsPerItem = Math.max(0, retailPrice - groupPrice);

    for (const participant of product.joinedUsers) {
      if (!participant.user) continue;

      // Check if order already generated for this customer & product
      const existingOrder = await Order.findOne({
        customer: participant.user,
        product: product._id,
      });

      if (existingOrder) continue;

      const customer = await Customer.findById(participant.user);
      if (!customer) continue;

      const quantity = participant.quantity || 1;
      const totalAmount = groupPrice * quantity;
      const totalSavings = savingsPerItem * quantity;
      const uniqueOrderId = `BB-${Date.now().toString().slice(-6)}-${Math.floor(
        1000 + Math.random() * 9000
      )}`;

      await Order.create({
        orderId: uniqueOrderId,
        customer: customer._id,
        customerName: customer.name,
        customerEmail: customer.email,
        customerPhone: customer.phone || "Not provided",
        shippingAddress: customer.address || {
          street: "Default Address",
          city: "Metro City",
          state: "State",
          pincode: "110001",
        },
        product: product._id,
        productName: product.name,
        productImage: product.image || "",
        quantity,
        retailPrice,
        groupPrice,
        totalAmount,
        savings: totalSavings,
        orderStatus: "Placed",
        paymentStatus: "Paid (Demo)",
        paymentMethod: "Group Deal Auto-Checkout",
        orderDate: new Date(),
      });
    }
  } catch (err) {
    console.error("Auto order creation error:", err.message);
  }
}

// Helper: Check and update expired status for a product
function checkDealExpiration(product) {
  if (
    product.deadline &&
    new Date() > new Date(product.deadline) &&
    product.status === "active" &&
    product.joinedBuyers < product.targetBuyers
  ) {
    product.status = "expired";
    return true;
  }
  return false;
}

// ==========================================
// SYSTEM & HEALTH ROUTES
// ==========================================

app.get("/", (req, res) => {
  res.json({
    status: "success",
    message: "Welcome to BulkBuy API!",
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "success",
    message: "BulkBuy API is running",
    database:
      mongoose.connection.readyState === 1 ? "Connected" : "Disconnected",
  });
});

// ==========================================
// 1. CUSTOMER AUTHENTICATION
// ==========================================

// Customer Registration
app.post("/api/customer/register", async (req, res) => {
  try {
    const { name, email, password, phone, street, city, state, pincode } =
      req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Please enter your name, email address, and password.",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters long.",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existingCustomer = await Customer.findOne({ email: normalizedEmail });
    if (existingCustomer) {
      return res.status(400).json({
        message:
          "An account with this email already exists. Please log in instead.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const customer = await Customer.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      phone: phone ? phone.trim() : "",
      address: {
        street: street ? street.trim() : "",
        city: city ? city.trim() : "",
        state: state ? state.trim() : "",
        pincode: pincode ? pincode.trim() : "",
      },
    });

    const token = jwt.sign(
      {
        id: customer._id,
        role: "customer",
        email: customer.email,
        name: customer.name,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      message: "Registration successful! Welcome to BulkBuy.",
      token,
      customer: customer.toSafeObject(),
    });
  } catch (error) {
    console.error("Customer register error:", error.message);
    res.status(500).json({
      message: "Failed to register account. Please try again.",
    });
  }
});

// Customer Login
app.post("/api/customer/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Please provide both email and password.",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const customer = await Customer.findOne({ email: normalizedEmail });
    if (!customer) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    const passwordMatches = await bcrypt.compare(password, customer.password);
    if (!passwordMatches) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    const token = jwt.sign(
      {
        id: customer._id,
        role: "customer",
        email: customer.email,
        name: customer.name,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: `Welcome back, ${customer.name}!`,
      token,
      customer: customer.toSafeObject(),
    });
  } catch (error) {
    console.error("Customer login error:", error.message);
    res.status(500).json({
      message: "Server error during login. Please try again.",
    });
  }
});

// Customer Profile (Get)
app.get("/api/customer/profile", verifyCustomer, async (req, res) => {
  try {
    const customer = await Customer.findById(req.customer.id);
    if (!customer) {
      return res.status(404).json({ message: "Customer profile not found." });
    }

    res.json(customer.toSafeObject());
  } catch (_error) {
    res.status(500).json({ message: "Failed to retrieve profile." });
  }
});

// Customer Profile (Update)
app.put("/api/customer/profile", verifyCustomer, async (req, res) => {
  try {
    const { name, phone, address } = req.body;

    const customer = await Customer.findById(req.customer.id);
    if (!customer) {
      return res.status(404).json({ message: "Customer profile not found." });
    }

    if (name) customer.name = name.trim();
    if (phone !== undefined) customer.phone = phone.trim();
    if (address && typeof address === "object") {
      customer.address = {
        street: address.street || customer.address?.street || "",
        city: address.city || customer.address?.city || "",
        state: address.state || customer.address?.state || "",
        pincode: address.pincode || customer.address?.pincode || "",
      };
    }

    await customer.save();

    res.json({
      message: "Profile updated successfully!",
      customer: customer.toSafeObject(),
    });
  } catch (_error) {
    res.status(500).json({ message: "Failed to update profile." });
  }
});

// ==========================================
// 2. ADMIN AUTHENTICATION
// ==========================================

app.post("/api/admin/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Please enter email and password.",
      });
    }

    const admin = await Admin.findOne({
      email: email.toLowerCase().trim(),
    });

    if (!admin) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    const passwordMatches = await bcrypt.compare(password, admin.password);

    if (!passwordMatches) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    const token = jwt.sign(
      {
        id: admin._id,
        role: "admin",
      },
      JWT_SECRET,
      {
        expiresIn: "6h",
      }
    );

    res.json({
      message: "Admin login successful!",
      token,
      admin: {
        email: admin.email,
      },
    });
  } catch (error) {
    console.error("Admin login error:", error.message);
    res.status(500).json({
      message: "Server error during login.",
    });
  }
});

// ==========================================
// 3. PRODUCT & GROUP BUYING ROUTES
// ==========================================

// Get all products (with expiration check)
app.get("/api/products", extractCustomer, async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });

    // Auto-update any expired deals
    for (const p of products) {
      if (checkDealExpiration(p)) {
        await p.save();
      }
    }

    // Attach joinedStatus if customer is logged in
    const customerId = req.customer?.id;
    const sanitizedProducts = products.map((prod) => {
      const doc = prod.toObject();
      if (customerId && Array.isArray(doc.joinedUsers)) {
        doc.hasJoined = doc.joinedUsers.some(
          (u) => u.user && u.user.toString() === customerId
        );
      } else {
        doc.hasJoined = false;
      }
      return doc;
    });

    res.json(sanitizedProducts);
  } catch (error) {
    console.error("Fetch products error:", error.message);
    res.status(500).json({
      message: "Could not fetch products.",
    });
  }
});

// Get single product details
app.get("/api/products/:id", extractCustomer, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid product ID.",
      });
    }

    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        message: "Product not found.",
      });
    }

    if (checkDealExpiration(product)) {
      await product.save();
    }

    const doc = product.toObject();
    const customerId = req.customer?.id;
    if (customerId && Array.isArray(doc.joinedUsers)) {
      doc.hasJoined = doc.joinedUsers.some(
        (u) => u.user && u.user.toString() === customerId
      );
    } else {
      doc.hasJoined = false;
    }

    res.json(doc);
  } catch (_error) {
    res.status(500).json({
      message: "Could not fetch product details.",
    });
  }
});

// Join a group deal (Customer Protected with Concurrency Safety & Duplicate Prevention)
app.post("/api/products/:id/join", verifyCustomer, async (req, res) => {
  try {
    const productId = req.params.id;
    const customerId = req.customer.id;

    if (!mongoose.isValidObjectId(productId)) {
      return res.status(400).json({
        message: "Invalid product ID.",
      });
    }

    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        message: "Product not found.",
      });
    }

    // Check expiration
    if (checkDealExpiration(product)) {
      await product.save();
      return res.status(400).json({
        message: "This group deal has expired. Joining is no longer available.",
        product,
      });
    }

    // Check if already full or successfully completed
    if (
      product.status === "successful" ||
      product.joinedBuyers >= product.targetBuyers
    ) {
      return res.status(400).json({
        message:
          "This group deal is already complete and has reached its target!",
        product,
      });
    }

    // Prevent duplicate joining by same customer
    const alreadyJoined = product.joinedUsers.some(
      (entry) => entry.user && entry.user.toString() === customerId
    );

    if (alreadyJoined) {
      return res.status(400).json({
        message: "You have already joined this group deal!",
        alreadyJoined: true,
        product,
      });
    }

    // Atomic update to ensure accurate buyer counts even with concurrent joins
    const updatedProduct = await Product.findOneAndUpdate(
      {
        _id: productId,
        "joinedUsers.user": { $ne: customerId },
        joinedBuyers: { $lt: product.targetBuyers },
        status: "active",
      },
      {
        $inc: { joinedBuyers: 1 },
        $push: {
          joinedUsers: {
            user: customerId,
            quantity: 1,
            joinedAt: new Date(),
          },
        },
      },
      { returnDocument: "after" }
    );

    if (!updatedProduct) {
      // Re-fetch to return latest accurate state
      const refreshed = await Product.findById(productId);
      return res.status(400).json({
        message:
          "Could not join deal: it may have just reached its target or you already joined.",
        product: refreshed,
      });
    }

    // Automatically mark deal as successful if target is reached
    let dealCompletedNow = false;
    if (updatedProduct.joinedBuyers >= updatedProduct.targetBuyers) {
      updatedProduct.status = "successful";
      await updatedProduct.save();
      dealCompletedNow = true;

      // Automatically generate orders for all joined customers!
      await autoCreateOrdersForDeal(updatedProduct);
    }

    res.json({
      message: dealCompletedNow
        ? "🎉 Target reached! Group deal unlocked and orders generated at the discounted price!"
        : "Successfully joined the group deal! Together we save more.",
      product: updatedProduct,
      dealCompletedNow,
    });
  } catch (error) {
    console.error("Join deal error:", error.message);
    res.status(500).json({
      message: "Could not join the deal. Please try again.",
    });
  }
});

// Customer Dashboard: Get all deals joined by this customer
app.get("/api/customer/deals", verifyCustomer, async (req, res) => {
  try {
    const customerId = req.customer.id;

    const products = await Product.find({
      "joinedUsers.user": customerId,
    }).sort({ updatedAt: -1 });

    const customerDeals = products.map((prod) => {
      const participantInfo = prod.joinedUsers.find(
        (u) => u.user && u.user.toString() === customerId
      );

      const retailPrice = Number(prod.retailPrice) || 0;
      const groupPrice = Number(prod.groupPrice) || 0;
      const savings = Math.max(0, retailPrice - groupPrice);
      const progress = Math.min(
        100,
        Math.round(((prod.joinedBuyers || 0) / (prod.targetBuyers || 1)) * 100)
      );

      return {
        _id: prod._id,
        name: prod.name,
        category: prod.category,
        image: prod.image,
        retailPrice,
        groupPrice,
        savings,
        targetBuyers: prod.targetBuyers,
        joinedBuyers: prod.joinedBuyers,
        progress,
        status: prod.status,
        deadline: prod.deadline,
        joinedAt: participantInfo?.joinedAt || prod.createdAt,
        quantity: participantInfo?.quantity || 1,
      };
    });

    res.json(customerDeals);
  } catch (_error) {
    res.status(500).json({
      message: "Could not retrieve your group deals.",
    });
  }
});

// ==========================================
// 4. ORDER MANAGEMENT & DEMO CHECKOUT
// ==========================================

// Create an order (from Demo Checkout or direct group purchase)
app.post("/api/orders", verifyCustomer, async (req, res) => {
  try {
    const customerId = req.customer.id;
    const { productId, quantity = 1, shippingAddress, paymentMethod } = req.body;

    if (!productId || !mongoose.isValidObjectId(productId)) {
      return res.status(400).json({ message: "Invalid product selected." });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found." });
    }

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found." });
    }

    const orderQty = Math.max(1, Number(quantity) || 1);
    const retailPrice = Number(product.retailPrice) || 0;
    const groupPrice = Number(product.groupPrice) || 0;
    const totalAmount = groupPrice * orderQty;
    const savings = Math.max(0, retailPrice - groupPrice) * orderQty;

    const uniqueOrderId = `BB-${Date.now().toString().slice(-6)}-${Math.floor(
      1000 + Math.random() * 9000
    )}`;

    const order = await Order.create({
      orderId: uniqueOrderId,
      customer: customer._id,
      customerName: customer.name,
      customerEmail: customer.email,
      customerPhone: customer.phone || req.body.phone || "Not provided",
      shippingAddress: shippingAddress ||
        customer.address || {
          street: "Demo Street",
          city: "New Delhi",
          state: "Delhi",
          pincode: "110001",
        },
      product: product._id,
      productName: product.name,
      productImage: product.image || "",
      quantity: orderQty,
      retailPrice,
      groupPrice,
      totalAmount,
      savings,
      orderStatus: "Placed",
      paymentStatus: "Paid (Demo)",
      paymentMethod: paymentMethod || "Demo Simulated Payment",
      orderDate: new Date(),
    });

    res.status(201).json({
      message: "Demo order placed successfully! Thank you for buying together.",
      order,
    });
  } catch (error) {
    console.error("Order creation error:", error.message);
    res.status(500).json({
      message: "Could not place order. Please try again.",
    });
  }
});

// Customer: View own order history
app.get("/api/customer/orders", verifyCustomer, async (req, res) => {
  try {
    const orders = await Order.find({ customer: req.customer.id }).sort({
      orderDate: -1,
    });

    res.json(orders);
  } catch (_error) {
    res.status(500).json({
      message: "Could not fetch order history.",
    });
  }
});

// View single order details (Customer or Admin)
app.get("/api/orders/:id", async (req, res) => {
  try {
    let order = null;

    if (mongoose.isValidObjectId(req.params.id)) {
      order = await Order.findById(req.params.id);
    }

    if (!order) {
      order = await Order.findOne({ orderId: req.params.id });
    }

    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    res.json(order);
  } catch (_error) {
    res.status(500).json({ message: "Could not retrieve order details." });
  }
});

// ==========================================
// 5. ADMIN MANAGEMENT & DASHBOARD APIS
// ==========================================

// Admin: Overview Statistics (MongoDB-driven)
app.get("/api/admin/stats", verifyAdmin, async (req, res) => {
  try {
    const [
      totalCustomers,
      totalOrders,
      totalProducts,
      successfulDeals,
      activeDeals,
      expiredDeals,
      orderAggregations,
    ] = await Promise.all([
      Customer.countDocuments(),
      Order.countDocuments(),
      Product.countDocuments(),
      Product.countDocuments({ status: "successful" }),
      Product.countDocuments({ status: "active" }),
      Product.countDocuments({ status: "expired" }),
      Order.aggregate([
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$totalAmount" },
            totalSavings: { $sum: "$savings" },
          },
        },
      ]),
    ]);

    const revenue = orderAggregations[0]?.totalRevenue || 0;
    const savings = orderAggregations[0]?.totalSavings || 0;

    res.json({
      totalCustomers,
      totalOrders,
      totalProducts,
      successfulDeals,
      activeDeals,
      expiredDeals,
      totalRevenue: revenue,
      totalSavings: savings,
    });
  } catch (error) {
    console.error("Admin stats error:", error.message);
    res.status(500).json({ message: "Could not fetch statistics." });
  }
});

// Admin: Get all orders
app.get("/api/admin/orders", verifyAdmin, async (req, res) => {
  try {
    const orders = await Order.find().sort({ orderDate: -1 });
    res.json(orders);
  } catch (_error) {
    res.status(500).json({ message: "Could not fetch orders." });
  }
});

// Admin: Update order status
app.put("/api/admin/orders/:id/status", verifyAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = [
      "Placed",
      "Processing",
      "Shipped",
      "Delivered",
      "Cancelled",
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        message: `Invalid status. Choose from: ${validStatuses.join(", ")}`,
      });
    }

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { orderStatus: status },
      { returnDocument: "after" }
    );

    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    res.json({
      message: `Order status updated to ${status}!`,
      order,
    });
  } catch (_error) {
    res.status(500).json({ message: "Could not update order status." });
  }
});

// Admin: Get all registered customers
app.get("/api/admin/customers", verifyAdmin, async (req, res) => {
  try {
    const customers = await Customer.find()
      .select("-password")
      .sort({ createdAt: -1 });

    // Attach order and deal counts for each customer
    const customersWithStats = await Promise.all(
      customers.map(async (cust) => {
        const orderCount = await Order.countDocuments({ customer: cust._id });
        const dealsCount = await Product.countDocuments({
          "joinedUsers.user": cust._id,
        });

        return {
          ...cust.toObject(),
          orderCount,
          dealsCount,
        };
      })
    );

    res.json(customersWithStats);
  } catch (_error) {
    res.status(500).json({ message: "Could not fetch customer list." });
  }
});

// Admin: Manage deal status and deadline
app.put("/api/admin/deals/:id/status", verifyAdmin, async (req, res) => {
  try {
    const { status, deadline } = req.body;
    const updates = {};

    if (status && ["active", "successful", "expired"].includes(status)) {
      updates.status = status;
    }

    if (deadline) {
      updates.deadline = new Date(deadline);
    }

    const product = await Product.findByIdAndUpdate(req.params.id, updates, {
      returnDocument: "after",
    });

    if (!product) {
      return res.status(404).json({ message: "Deal not found." });
    }

    // If marked successful, trigger orders
    if (updates.status === "successful") {
      await autoCreateOrdersForDeal(product);
    }

    res.json({
      message: "Deal updated successfully!",
      product,
    });
  } catch (_error) {
    res.status(500).json({ message: "Could not update deal." });
  }
});

// ==========================================
// 6. ADMIN PRODUCT CRUD (EXISTING PRESERVED)
// ==========================================

// Add a product
app.post("/api/products", verifyAdmin, async (req, res) => {
  try {
    const {
      name,
      description,
      retailPrice,
      groupPrice,
      targetBuyers,
      joinedBuyers,
      image,
      category,
      deadline,
    } = req.body;

    if (
      !name ||
      retailPrice === undefined ||
      groupPrice === undefined ||
      targetBuyers === undefined
    ) {
      return res.status(400).json({
        message: "Please provide all required product details.",
      });
    }

    if (
      !Number.isFinite(Number(retailPrice)) ||
      !Number.isFinite(Number(groupPrice)) ||
      !Number.isInteger(Number(targetBuyers)) ||
      Number(retailPrice) < 0 ||
      Number(groupPrice) < 0 ||
      Number(targetBuyers) < 1
    ) {
      return res.status(400).json({
        message: "Please enter valid product prices and buyer target.",
      });
    }

    const product = await Product.create({
      name: name.trim(),
      description: description || "",
      retailPrice: Number(retailPrice),
      groupPrice: Number(groupPrice),
      targetBuyers: Number(targetBuyers),
      joinedBuyers: Number(joinedBuyers) || 0,
      image: image || "",
      category: category || "General",
      deadline: deadline
        ? new Date(deadline)
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: "active",
    });

    res.status(201).json({
      message: "Product added successfully!",
      product,
    });
  } catch (error) {
    console.error("Add product error:", error.message);
    res.status(500).json({
      message: "Could not add product.",
    });
  }
});

// Update a product
app.put("/api/products/:id", verifyAdmin, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid product ID.",
      });
    }

    const allowedFields = [
      "name",
      "description",
      "retailPrice",
      "groupPrice",
      "targetBuyers",
      "joinedBuyers",
      "image",
      "category",
      "status",
      "deadline",
    ];

    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (field === "deadline") {
          updates[field] = new Date(req.body[field]);
        } else {
          updates[field] = req.body[field];
        }
      }
    }

    const product = await Product.findByIdAndUpdate(req.params.id, updates, {
      returnDocument: "after",
      runValidators: true,
    });

    if (!product) {
      return res.status(404).json({
        message: "Product not found.",
      });
    }

    res.json({
      message: "Product updated successfully!",
      product,
    });
  } catch (error) {
    console.error("Update product error:", error.message);
    res.status(500).json({
      message: "Could not update product.",
    });
  }
});

// Delete a product
app.delete("/api/products/:id", verifyAdmin, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid product ID.",
      });
    }

    const product = await Product.findByIdAndDelete(req.params.id);

    if (!product) {
      return res.status(404).json({
        message: "Product not found.",
      });
    }

    res.json({
      message: "Product deleted successfully!",
    });
  } catch (error) {
    console.error("Delete product error:", error.message);
    res.status(500).json({
      message: "Could not delete product.",
    });
  }
});

// ==========================================
// START SERVER
// ==========================================

async function startServer() {
  try {
    checkEnvironment();

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`BulkBuy API running at http://localhost:${PORT}`);
    });

    const connectWithRetry = async (attempt = 1) => {
      try {
        await mongoose.connect(MONGODB_URI, {
          serverSelectionTimeoutMS: 5000,
        });
        console.log("MongoDB connected successfully!");
        await createAdmin();
      } catch (dbErr) {
        console.error(`MongoDB connection error (attempt ${attempt}):`, dbErr.message);
        console.log("Retrying MongoDB connection in 5 seconds...");
        setTimeout(() => connectWithRetry(attempt + 1), 5000);
      }
    };

    await connectWithRetry();
  } catch (error) {
    console.error("Server startup failed:", error.message);
  }
}

// Export app for testing or start server
if (require.main === module) {
  startServer();
}

module.exports = app;
