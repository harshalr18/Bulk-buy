# BulkBuy – Buy Together, Pay Less

**BulkBuy** is a modern, responsive full-stack group-buying marketplace built with **React 19, Vite, Node.js, Express, and MongoDB Atlas**. BulkBuy allows consumers to pool their purchasing power to unlock wholesale tier discounts on products they love.

---

## 📑 Table of Contents

1. [Project Overview & Architecture](#-project-overview--architecture)
2. [Key Features](#-key-features)
3. [MongoDB Collections & Schemas](#-mongodb-collections--schemas)
4. [API Endpoints Documentation](#-api-endpoints-documentation)
5. [Installation & Execution Guide](#-installation--execution-guide)
6. [End-to-End Workflow](#-end-to-end-workflow)
7. [College Demonstration Checklist](#-college-demonstration-checklist)
8. [Resume Project Description](#-resume-project-description)
9. [Security & Environment Variables](#-security--environment-variables)

---

## 🏛️ Project Overview & Architecture

BulkBuy bridges individual shoppers with community group volume discounts. When enough buyers join a deal before the deadline, the group discount unlocks for all participants, orders are generated, and savings are realized.

```
                         ┌────────────────────────────────────────┐
                         │       React 19 + Vite Frontend         │
                         │        (Port 5173 / Same-Origin)       │
                         └──────────────────┬─────────────────────┘
                                            │ Reverse Proxy (/api)
                                            ▼
                         ┌────────────────────────────────────────┐
                         │       Node.js + Express REST API       │
                         │               (Port 5001)              │
                         │   • JWT Auth (Customer & Admin)        │
                         │   • Concurrency-Safe Atomic Deals      │
                         │   • Dynamic Order & Stats Engine       │
                         └──────────────────┬─────────────────────┘
                                            │ Mongoose ODM
                                            ▼
                         ┌────────────────────────────────────────┐
                         │          MongoDB Atlas Cluster         │
                         │  • customers  • products               │
                         │  • orders     • admins                 │
                         └────────────────────────────────────────┘
```

### Architecture Highlights
- **Client Tier**: React 19 SPA bundled with Vite. Provides a clean green-themed design, real-time progress bars, countdown timers, toast notification system, and dedicated portals for customers and administrators.
- **API Tier**: Express 5 application on port 5001. Features role-segregated JWT authorization (`customer` vs `admin`), atomic MongoDB transactions (`$inc`, `$push`, concurrency guards), input sanitization, and automatic order generation on group deal success.
- **Database Tier**: Hosted MongoDB Atlas cluster utilizing indexed schemas with relations across Customers, Products, Group Deals, and Orders.

---

## ✨ Key Features

### 1. Customer Authentication & Profile
- Customer registration with validation (name, email, password, phone, delivery address).
- Secure password hashing using `bcryptjs` with salt rounds.
- JWT-based session tokens with role identification (`role: "customer"`).
- Profile view and real-time shipping address editor.
- Protected customer dashboard and routes.

### 2. Group Buying Workflow & Concurrency Protection
- **Dynamic Buyer Target**: Each deal specifies target buyers needed vs current joined buyers.
- **Visual Progress Bar**: Instant feedback on group progress percentage.
- **Duplicate Prevention**: Unique atomic validation prevents duplicate joining by the same user.
- **Deadline Handling**: Real-time expiry detection automatically marks deals as expired once deadlines pass.
- **Auto-Completion**: Automatically marks deals as `successful` when the target is reached and creates orders for participants.

### 3. Product Details & Discovery
- High-resolution product images with fallbacks.
- Instant retail vs group price comparison showing rupee savings and percentage discount.
- Live countdown timers showing remaining days/hours.
- Category filtering (Electronics, Wearables, Home & Furniture, Sports, Fashion, etc.).
- Instant product search.
- One-click deal link sharing.

### 4. Demo Checkout & Simulated Payment
- Comprehensive order summary card with item details and savings breakdown.
- Quantity selector with dynamic subtotal, group discount savings, and free delivery indicator.
- Educational, simulated payment flow (Simulated UPI, Simulated Cards, Cash on Delivery).
- Explicit demo notices verifying no real money or card numbers are handled.
- Order confirmation view with unique Order ID (`BB-XXXX-XXXX`) and direct tracking button.

### 5. Customer Dashboard
- **My Group Deals**: Track all joined deals, buyer progress, and deal status (Active, Target Reached, Expired).
- **Order History**: Review previous orders, order IDs, date, quantity, total paid, and savings.
- **Order Details Modal**: Step-by-step visual delivery timeline (`Placed` → `Processing` → `Shipped` → `Delivered`), item summary, and address breakdown.
- **Personal Profile**: Update contact phone and delivery address.

### 6. Extended Admin Control Center
- Dynamic analytics queried live from MongoDB Atlas:
  - Total registered customers
  - Total completed orders
  - Total marketplace volume (revenue)
  - Total customer savings generated
  - Total catalog products
  - Active, Successful, and Expired deals count
- **Catalog Management**: Add, update, delete products, configure buyer targets and deadlines.
- **Deal Status Management**: Manually complete or reopen group deals.
- **Order Management**: Search and filter orders by status (`Placed`, `Processing`, `Shipped`, `Delivered`, `Cancelled`) with live status update dropdowns.
- **Customer Directory**: View customer profiles, joined deals count, and total orders.

---

## 🗄️ MongoDB Collections & Schemas

### 1. `customers` Collection
```javascript
{
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true }, // Bcrypt hashed
  phone: { type: String, default: "" },
  address: {
    street: String,
    city: String,
    state: String,
    pincode: String
  },
  createdAt: Date,
  updatedAt: Date
}
```

### 2. `products` Collection
```javascript
{
  name: { type: String, required: true },
  description: { type: String, default: "" },
  retailPrice: { type: Number, required: true },
  groupPrice: { type: Number, required: true },
  targetBuyers: { type: Number, required: true },
  joinedBuyers: { type: Number, default: 0 },
  category: { type: String, default: "General" },
  image: { type: String, default: "" },
  status: { type: String, enum: ["active", "successful", "expired"], default: "active" },
  deadline: { type: Date },
  joinedUsers: [
    {
      user: { type: ObjectId, ref: "Customer" },
      joinedAt: { type: Date, default: Date.now },
      quantity: { type: Number, default: 1 }
    }
  ],
  createdAt: Date,
  updatedAt: Date
}
```

### 3. `orders` Collection
```javascript
{
  orderId: { type: String, required: true, unique: true }, // e.g. BB-466579-3236
  customer: { type: ObjectId, ref: "Customer", required: true },
  customerName: String,
  customerEmail: String,
  customerPhone: String,
  shippingAddress: {
    street: String,
    city: String,
    state: String,
    pincode: String
  },
  product: { type: ObjectId, ref: "Product", required: true },
  productName: String,
  productImage: String,
  quantity: { type: Number, default: 1 },
  retailPrice: Number,
  groupPrice: Number,
  totalAmount: Number,
  savings: Number,
  orderStatus: {
    type: String,
    enum: ["Placed", "Processing", "Shipped", "Delivered", "Cancelled"],
    default: "Placed"
  },
  paymentStatus: { type: String, default: "Paid (Demo)" },
  paymentMethod: { type: String, default: "Demo UPI" },
  orderDate: { type: Date, default: Date.now },
  createdAt: Date,
  updatedAt: Date
}
```

### 4. `admins` Collection
```javascript
{
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true }, // Bcrypt hashed
  createdAt: Date,
  updatedAt: Date
}
```

---

## 📡 API Endpoints Documentation

### Public & Customer Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/health` | None | API and MongoDB health status |
| `GET` | `/api/products` | Optional | Get all products with expiration and joined flags |
| `GET` | `/api/products/:id` | Optional | Get single product details |
| `POST` | `/api/customer/register` | None | Register new customer account |
| `POST` | `/api/customer/login` | None | Customer login and JWT issuance |
| `GET` | `/api/customer/profile` | Customer JWT | Get customer profile details |
| `PUT` | `/api/customer/profile` | Customer JWT | Update contact phone and address |
| `POST` | `/api/products/:id/join` | Customer JWT | Join a group deal with atomic validation |
| `GET` | `/api/customer/deals` | Customer JWT | Get all deals joined by this customer |
| `POST` | `/api/orders` | Customer JWT | Create a demo checkout order |
| `GET` | `/api/customer/orders` | Customer JWT | View customer order history |
| `GET` | `/api/orders/:id` | JWT | Get single order details & tracking |

### Admin Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/admin/login` | None | Administrator authentication |
| `GET` | `/api/admin/stats` | Admin JWT | Live MongoDB stats (Customers, Orders, Revenue, Savings, Deals) |
| `GET` | `/api/admin/orders` | Admin JWT | List all orders in marketplace |
| `PUT` | `/api/admin/orders/:id/status`| Admin JWT | Update order status (`Placed` → `Delivered`) |
| `GET` | `/api/admin/customers` | Admin JWT | Directory of customers with deal & order metrics |
| `POST` | `/api/products` | Admin JWT | Add new product and group deal |
| `PUT` | `/api/products/:id` | Admin JWT | Update product details |
| `DELETE`| `/api/products/:id` | Admin JWT | Delete product |
| `PUT` | `/api/admin/deals/:id/status`| Admin JWT | Manually toggle deal status (`active`, `successful`, `expired`) |

---

## 🚀 Installation & Execution Guide

### Prerequisites
- Node.js (v18 or higher)
- npm (v9 or higher)
- Active MongoDB Atlas connection string

### 1. Backend Setup
```bash
cd bulkbuy/server
npm install
```
Ensure `server/.env` is configured:
```env
PORT=5001
MONGODB_URI=your_mongodb_atlas_connection_string
ADMIN_EMAIL=admin@bulkbuy.com
ADMIN_PASSWORD=replace_with_a_unique_strong_password
JWT_SECRET=your_jwt_secret_key
```

Seed initial sample catalog (optional):
```bash
npm run seed
```

Start backend API server:
```bash
npm run dev
# Or for production:
npm start
```
The backend starts at `http://localhost:5001`.

### 2. Frontend Setup
In a new terminal window from the project root:
```bash
cd bulkbuy
npm install
npm run dev
```
The frontend starts at `http://localhost:5173`.

Vite forwards `/api` requests to `http://localhost:5001` via proxy.

---

## 🔄 End-to-End Workflow

1. **Discovery**: A visitor browses active deals on the homepage, filters by category (e.g. *Electronics*), or uses instant search.
2. **Details & Verification**: The visitor clicks a product to inspect retail vs group price, rupee savings, buyer target, and deal deadline.
3. **Authentication**: To lock in the group discount, the user signs in or creates an account in seconds.
4. **Group Participation**: The user clicks **Join Group Deal**. The atomic counter increments, progress fills, and duplicate attempts are blocked.
5. **Goal Reached**: When the target buyer count is satisfied, the deal transitions to `successful`, unlocking group orders.
6. **Demo Checkout**: The customer selects their quantity, verifies delivery destination, chooses a simulated payment method (UPI / Card / COD), and confirms the order.
7. **Tracking & Dashboard**: The customer tracks their joined deals, order receipt, and visual shipping milestones in the Customer Dashboard.
8. **Admin Operations**: An administrator signs in to `/admin` to monitor real-time revenue and savings, update delivery stages (`Processing` → `Shipped`), manage products, and inspect customer engagement.

---

## 🎓 College Demonstration Checklist

Follow this sequence for an impressive presentation to project evaluators:

1. **Homepage & Brand Showcase**: Show clean green typography, responsive design, hero stats, and How It Works steps.
2. **Public Deal Browsing**: Demonstrate category pills (*Electronics*, *Home*, *Wearables*) and search bar filtering.
3. **Customer Registration**: Click **Register**, enter new customer details, and show immediate session activation and greeting.
4. **Product Details & Group Deal Joining**: Open a product (e.g., *Wireless Headphones*), show progress bar and deadline, click **Join Group Deal**, and show the toast notification.
5. **Duplicate Prevention**: Click the join button again to demonstrate that the backend rejects duplicate joins.
6. **Demo Checkout Simulation**: Click **Demo Checkout**, change quantity to 2, demonstrate live savings recalculation, select **Simulated UPI**, and confirm the order.
7. **Customer Dashboard**: Open **My Dashboard** to showcase:
   - Joined Deals tab with progress bar
   - Order History tab with unique Order ID (`BB-XXXX-XXXX`)
   - Order Details modal with 4-step delivery tracking timeline
   - Profile tab with editable shipping address
8. **Admin Control Center**: Click **🛡️ Admin** in the navbar (or visit `/admin`), then log in using the `ADMIN_EMAIL` and `ADMIN_PASSWORD` values configured in `server/.env`:
   - Highlight live MongoDB statistics (total customers, orders, revenue, customer savings).
   - Filter orders and change the status of the recently created order from `Placed` to `Shipped`.
   - Switch back to the Customer Dashboard to show the order status updated in real-time.
   - Showcase Product Management (add/edit product) and Customer Directory.

---

## 💼 Resume Project Description

**BulkBuy – Full-Stack Group-Buying E-Commerce Platform**
*React 19, Vite, Node.js, Express, MongoDB Atlas, JWT, Bcrypt, REST API*
- Architected and developed a full-stack group buying marketplace enabling customers to pool purchasing volume and unlock wholesale discounts.
- Implemented role-based JWT authentication separating customer and administrator portals with encrypted password hashing.
- Engineered concurrency-safe group deal workflows using atomic MongoDB operations (`$inc`, `$push`) to guarantee accurate buyer counts, prevent duplicate joining, and auto-complete deals upon target fulfillment.
- Built a simulated demo checkout system with order generation (`BB-XXXX-XXXX`), dynamic rupee savings breakdown, and a customer tracking dashboard.
- Created an administrative analytics dashboard querying real-time MongoDB metrics for order dispatch management, catalog CRUD, and buyer activity tracking.

---

## 🔒 Security & Environment Variables

- `.env` files and credentials are excluded from version control via `.gitignore`.
- Backend uses environment variable checks on startup and exits safely with clear diagnostics if variables are missing.
- Passwords are encrypted using bcrypt (12 rounds).
- Client requests are proxied same-origin through Vite to prevent CORS drift and avoid exposing internal service details.
