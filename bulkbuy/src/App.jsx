import React, { useEffect, useState } from "react";
import Admin from "./Admin";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL || "/api";
const currentYear = new Date().getFullYear();

export default function App() {
  // Navigation / View state: 'marketplace', 'product-detail', 'checkout', 'dashboard', 'order-success', 'admin'
  const [currentView, setCurrentView] = useState(() => {
    if (window.location.pathname === "/admin") return "admin";
    return "marketplace";
  });

  // Selected product for Details or Checkout
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [lastPlacedOrder, setLastPlacedOrder] = useState(null);
  const [dashboardTab, setDashboardTab] = useState("deals"); // 'deals', 'orders', 'profile'

  // Customer Auth state
  const [customerToken, setCustomerToken] = useState(
    () => localStorage.getItem("bulkbuy_customer_token") || ""
  );
  const [customerUser, setCustomerUser] = useState(() => {
    try {
      const saved = localStorage.getItem("bulkbuy_customer_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Auth Modal State
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login"); // 'login' or 'register'
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authPhone, setAuthPhone] = useState("");
  const [authStreet, setAuthStreet] = useState("");
  const [authCity, setAuthCity] = useState("");
  const [authState, setAuthState] = useState("");
  const [authPincode, setAuthPincode] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  // Customer Dashboard Data
  const [myDeals, setMyDeals] = useState([]);
  const [myOrders, setMyOrders] = useState([]);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState(null);
  const [profileForm, setProfileForm] = useState({
    name: "",
    phone: "",
    street: "",
    city: "",
    state: "",
    pincode: "",
  });
  const [profileSaving, setProfileSaving] = useState(false);

  // Products state
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [joiningId, setJoiningId] = useState(null);

  // Checkout form state
  const [checkoutQty, setCheckoutQty] = useState(1);
  const [checkoutShipping, setCheckoutShipping] = useState({
    street: "",
    city: "",
    state: "",
    pincode: "",
    phone: "",
  });
  const [checkoutPaymentMethod, setCheckoutPaymentMethod] =
    useState("Simulated UPI (Google Pay / PhonePe)");
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  // Notification Toast State
  const [toast, setToast] = useState(null);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3800);
  };

  // Synchronize browser history / URL path
  useEffect(() => {
    const handlePopState = () => {
      if (window.location.pathname === "/admin") {
        setCurrentView("admin");
      } else {
        setCurrentView("marketplace");
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigateTo = (view, product = null) => {
    setCurrentView(view);
    if (product) setSelectedProduct(product);
    if (view === "admin") {
      window.history.pushState(null, "", "/admin");
    } else {
      window.history.pushState(null, "", "/");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // Fetch products from backend
  const fetchProducts = async (retryCount = 0) => {
    try {
      if (retryCount === 0) {
        setLoading(true);
        setError("");
      }

      const headers = {};
      if (customerToken) {
        headers.Authorization = `Bearer ${customerToken}`;
      }

      const response = await fetch(`${API_URL}/products`, { headers });
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 503 && retryCount < 3) {
          setTimeout(() => fetchProducts(retryCount + 1), 1000);
          return;
        }
        throw new Error(data.message || "Unable to load products.");
      }

      setProducts(Array.isArray(data) ? data : []);
      setLoading(false);
    } catch (err) {
      if (retryCount < 2) {
        setTimeout(() => fetchProducts(retryCount + 1), 1200);
        return;
      }
      setError(err.message || "Cannot connect to BulkBuy backend.");
      setLoading(false);
    }
  };

  // Fetch customer deals & orders when logged in
  const fetchCustomerData = async () => {
    if (!customerToken) return;

    try {
      // Fetch deals
      const dealsRes = await fetch(`${API_URL}/customer/deals`, {
        headers: { Authorization: `Bearer ${customerToken}` },
      });
      if (dealsRes.ok) {
        const dealsData = await dealsRes.json();
        setMyDeals(dealsData);
      }

      // Fetch orders
      const ordersRes = await fetch(`${API_URL}/customer/orders`, {
        headers: { Authorization: `Bearer ${customerToken}` },
      });
      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        setMyOrders(ordersData);
      }

      // Fetch profile
      const profRes = await fetch(`${API_URL}/customer/profile`, {
        headers: { Authorization: `Bearer ${customerToken}` },
      });
      if (profRes.ok) {
        const profData = await profRes.json();
        setCustomerUser(profData);
        localStorage.setItem("bulkbuy_customer_user", JSON.stringify(profData));
        setProfileForm({
          name: profData.name || "",
          phone: profData.phone || "",
          street: profData.address?.street || "",
          city: profData.address?.city || "",
          state: profData.address?.state || "",
          pincode: profData.address?.pincode || "",
        });
        setCheckoutShipping({
          street: profData.address?.street || "102, Green Avenue",
          city: profData.address?.city || "New Delhi",
          state: profData.address?.state || "Delhi",
          pincode: profData.address?.pincode || "110001",
          phone: profData.phone || "9876543210",
        });
      }
    } catch (err) {
      console.error("Error loading customer data:", err);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [customerToken]);

  useEffect(() => {
    if (customerToken) {
      fetchCustomerData();
    }
  }, [customerToken, currentView]);

  // Handle Customer Login
  const handleCustomerLogin = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError("");

    try {
      const res = await fetch(`${API_URL}/customer/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: authEmail, password: authPassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Invalid login credentials.");
      }

      setCustomerToken(data.token);
      setCustomerUser(data.customer);
      localStorage.setItem("bulkbuy_customer_token", data.token);
      localStorage.setItem("bulkbuy_customer_user", JSON.stringify(data.customer));

      setIsAuthModalOpen(false);
      setAuthPassword("");
      showToast(data.message || "Logged in successfully!", "success");
      fetchProducts();
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  // Handle Customer Registration
  const handleCustomerRegister = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError("");

    try {
      const res = await fetch(`${API_URL}/customer/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: authName,
          email: authEmail,
          password: authPassword,
          phone: authPhone,
          street: authStreet,
          city: authCity,
          state: authState,
          pincode: authPincode,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to register account.");
      }

      setCustomerToken(data.token);
      setCustomerUser(data.customer);
      localStorage.setItem("bulkbuy_customer_token", data.token);
      localStorage.setItem("bulkbuy_customer_user", JSON.stringify(data.customer));

      setIsAuthModalOpen(false);
      setAuthPassword("");
      showToast(data.message || "Welcome to BulkBuy!", "success");
      fetchProducts();
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  // Handle Customer Logout
  const handleCustomerLogout = () => {
    setCustomerToken("");
    setCustomerUser(null);
    localStorage.removeItem("bulkbuy_customer_token");
    localStorage.removeItem("bulkbuy_customer_user");
    showToast("You have been logged out.", "info");
    if (currentView === "dashboard" || currentView === "checkout") {
      setCurrentView("marketplace");
    }
    fetchProducts();
  };

  // Update Profile
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setProfileSaving(true);

    try {
      const res = await fetch(`${API_URL}/customer/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${customerToken}`,
        },
        body: JSON.stringify({
          name: profileForm.name,
          phone: profileForm.phone,
          address: {
            street: profileForm.street,
            city: profileForm.city,
            state: profileForm.state,
            pincode: profileForm.pincode,
          },
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to update profile.");
      }

      setCustomerUser(data.customer);
      localStorage.setItem("bulkbuy_customer_user", JSON.stringify(data.customer));
      showToast("Profile details updated successfully!", "success");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setProfileSaving(false);
    }
  };

  // Join a group deal (Requires Auth)
  const joinDeal = async (productId) => {
    if (!customerToken) {
      setAuthMode("login");
      setIsAuthModalOpen(true);
      showToast("Please log in to join group deals and unlock savings.", "info");
      return;
    }

    if (joiningId !== null) return;

    try {
      setJoiningId(productId);

      const response = await fetch(`${API_URL}/products/${productId}/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${customerToken}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.product) {
          setProducts((currentProducts) =>
            currentProducts.map((product) =>
              product._id === productId
                ? { ...data.product, hasJoined: data.alreadyJoined || false }
                : product
            )
          );
          if (selectedProduct && selectedProduct._id === productId) {
            setSelectedProduct({
              ...data.product,
              hasJoined: data.alreadyJoined || false,
            });
          }
        }
        throw new Error(data.message || "Unable to join the deal.");
      }

      setProducts((currentProducts) =>
        currentProducts.map((product) =>
          product._id === productId
            ? { ...data.product, hasJoined: true }
            : product
        )
      );

      if (selectedProduct && selectedProduct._id === productId) {
        setSelectedProduct({ ...data.product, hasJoined: true });
      }

      showToast(data.message || "Successfully joined the group deal!", "success");
      fetchCustomerData();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setJoiningId(null);
    }
  };

  // Open Checkout for a product
  const startCheckout = (product) => {
    if (!customerToken) {
      setAuthMode("login");
      setIsAuthModalOpen(true);
      showToast("Please log in to proceed to checkout.", "info");
      return;
    }
    setSelectedProduct(product);
    setCheckoutQty(1);
    navigateTo("checkout", product);
  };

  // Submit Demo Order
  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    if (!selectedProduct) return;
    setCheckoutLoading(true);

    try {
      const res = await fetch(`${API_URL}/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${customerToken}`,
        },
        body: JSON.stringify({
          productId: selectedProduct._id,
          quantity: checkoutQty,
          shippingAddress: checkoutShipping,
          paymentMethod: checkoutPaymentMethod,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to place demo order.");
      }

      setLastPlacedOrder(data.order);
      navigateTo("order-success");
      showToast("Order placed successfully!", "success");
      fetchCustomerData();
      fetchProducts();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setCheckoutLoading(false);
    }
  };

  // Categories list
  const categories = [
    "All",
    "Electronics",
    "Wearables",
    "Home & Furniture",
    "Sports & Fitness",
    "Fashion & Bags",
    "Kitchen & Dining",
  ];

  // Search & category filter
  const filteredProducts = products.filter((product) => {
    const searchText = search.trim().toLowerCase();
    const matchesCategory =
      selectedCategory === "All" ||
      product.category?.toLowerCase() === selectedCategory.toLowerCase();

    if (!matchesCategory) return false;
    if (!searchText) return true;

    return (
      product.name?.toLowerCase().includes(searchText) ||
      product.category?.toLowerCase().includes(searchText) ||
      product.description?.toLowerCase().includes(searchText)
    );
  });

  // Render Admin View
  if (currentView === "admin") {
    return <Admin />;
  }

  return (
    <div className="app-shell">
      {/* Toast Notifications */}
      {toast && (
        <div className={`toast-notification toast-${toast.type}`}>
          <span className="toast-icon">
            {toast.type === "success"
              ? "✓"
              : toast.type === "error"
                ? "⚠️"
                : "ℹ️"}
          </span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Navigation Bar */}
      <header className="navbar">
        <a
          href="#home"
          className="logo"
          onClick={(e) => {
            e.preventDefault();
            navigateTo("marketplace");
          }}
        >
          <span className="logo-icon">B</span>
          <span>
            Bulk<span className="logo-highlight">Buy</span>
          </span>
        </a>

        <nav className="nav-links">
          <a
            href="#home"
            className={currentView === "marketplace" ? "active-nav" : ""}
            onClick={(e) => {
              e.preventDefault();
              navigateTo("marketplace");
            }}
          >
            Marketplace
          </a>
          <a
            href="#deals"
            onClick={(e) => {
              if (currentView !== "marketplace") {
                e.preventDefault();
                navigateTo("marketplace");
                setTimeout(() => {
                  document.getElementById("deals")?.scrollIntoView({
                    behavior: "smooth",
                  });
                }, 100);
              }
            }}
          >
            Group Deals
          </a>
          <a
            href="#how-it-works"
            onClick={(e) => {
              if (currentView !== "marketplace") {
                e.preventDefault();
                navigateTo("marketplace");
                setTimeout(() => {
                  document.getElementById("how-it-works")?.scrollIntoView({
                    behavior: "smooth",
                  });
                }, 100);
              }
            }}
          >
            How It Works
          </a>
        </nav>

        {/* Auth / Profile Area */}
        <div className="nav-actions">
          {customerToken && customerUser ? (
            <div className="user-nav-dropdown">
              <button
                className="user-profile-button"
                onClick={() => {
                  navigateTo("dashboard");
                  setDashboardTab("deals");
                }}
              >
                <span className="user-avatar-circle">
                  {customerUser.name ? customerUser.name[0].toUpperCase() : "U"}
                </span>
                <span className="user-name-text">
                  {customerUser.name.split(" ")[0]}
                </span>
                <span className="dropdown-arrow">▾</span>
              </button>

              <button
                className="outline-button nav-order-btn"
                onClick={() => {
                  navigateTo("dashboard");
                  setDashboardTab("orders");
                }}
              >
                My Orders ({myOrders.length})
              </button>

              <button
                className="text-logout-btn"
                onClick={handleCustomerLogout}
                title="Log out"
              >
                Logout
              </button>
            </div>
          ) : (
            <div className="auth-buttons-group">
              <button
                className="secondary-button nav-login-btn"
                onClick={() => {
                  setAuthMode("login");
                  setAuthError("");
                  setIsAuthModalOpen(true);
                }}
              >
                Sign In
              </button>
              <button
                className="primary-button nav-register-btn"
                onClick={() => {
                  setAuthMode("register");
                  setAuthError("");
                  setIsAuthModalOpen(true);
                }}
              >
                Register
              </button>
            </div>
          )}

          <button
            className="admin-link-pill"
            onClick={() => navigateTo("admin")}
            title="Open Admin Portal"
          >
            🛡️ Admin
          </button>
        </div>
      </header>

      {/* ============================================================ */}
      {/* VIEW 1: PRODUCT DETAILS PAGE */}
      {/* ============================================================ */}
      {currentView === "product-detail" && selectedProduct && (
        <main className="product-detail-view">
          <div className="breadcrumb">
            <a
              href="#deals"
              onClick={(e) => {
                e.preventDefault();
                navigateTo("marketplace");
              }}
            >
              ← Back to Deals
            </a>
            <span>/</span>
            <span>{selectedProduct.category || "General"}</span>
            <span>/</span>
            <strong>{selectedProduct.name}</strong>
          </div>

          <div className="product-detail-container">
            <div className="detail-gallery">
              {selectedProduct.image ? (
                <img
                  src={selectedProduct.image}
                  alt={selectedProduct.name}
                  className="detail-main-image"
                />
              ) : (
                <div className="detail-image-fallback">🛍️</div>
              )}
              <div className="trust-strip">
                <div className="trust-item">
                  <span>🛡️</span>
                  <div>
                    <strong>Buyer Protection</strong>
                    <p>Verified group pricing guarantee</p>
                  </div>
                </div>
                <div className="trust-item">
                  <span>⚡</span>
                  <div>
                    <strong>Demo Checkout</strong>
                    <p>Instant simulated payment</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="detail-info">
              <span className="category-pill-lg">
                {selectedProduct.category || "General"}
              </span>

              <h1 className="detail-title">{selectedProduct.name}</h1>

              <p className="detail-description">
                {selectedProduct.description ||
                  "Join hands with fellow buyers to unlock exclusive bulk buying discounts on this quality product."}
              </p>

              {/* Price comparison card */}
              <div className="detail-price-box">
                <div className="price-item">
                  <span className="price-label">Retail Individual Price</span>
                  <div className="retail-price-lg">
                    ₹{Number(selectedProduct.retailPrice).toLocaleString("en-IN")}
                  </div>
                </div>

                <div className="price-item highlight-box">
                  <span className="price-label">Group Buying Price</span>
                  <div className="group-price-lg">
                    ₹{Number(selectedProduct.groupPrice).toLocaleString("en-IN")}
                  </div>
                </div>

                <div className="savings-badge-lg">
                  <span>🎉 Instant Savings:</span>
                  <strong>
                    ₹
                    {(
                      Number(selectedProduct.retailPrice) -
                      Number(selectedProduct.groupPrice)
                    ).toLocaleString("en-IN")}{" "}
                    (
                    {Math.round(
                      ((Number(selectedProduct.retailPrice) -
                        Number(selectedProduct.groupPrice)) /
                        (Number(selectedProduct.retailPrice) || 1)) *
                        100
                    )}
                    % OFF)
                  </strong>
                </div>
              </div>

              {/* Group Deal Progress Box */}
              <div className="detail-deal-card">
                <div className="deal-card-header">
                  <div>
                    <strong>Group Buying Status</strong>
                    <p>
                      {selectedProduct.joinedBuyers || 0} of{" "}
                      {selectedProduct.targetBuyers} required buyers joined
                    </p>
                  </div>
                  <span
                    className={`deal-status-badge badge-${selectedProduct.status || "active"}`}
                  >
                    {selectedProduct.status === "successful"
                      ? "Target Reached (Deal Unlocked!)"
                      : selectedProduct.status === "expired"
                        ? "Deal Expired"
                        : "Active Deal"}
                  </span>
                </div>

                <div className="progress-track-lg">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round(
                          ((selectedProduct.joinedBuyers || 0) /
                            (selectedProduct.targetBuyers || 1)) *
                            100
                        )
                      )}%`,
                    }}
                  />
                </div>

                <div className="deal-stats-row">
                  <div>
                    <span>👥 Target</span>
                    <strong>{selectedProduct.targetBuyers} buyers</strong>
                  </div>
                  <div>
                    <span>✅ Joined</span>
                    <strong>{selectedProduct.joinedBuyers || 0} buyers</strong>
                  </div>
                  <div>
                    <span>⏰ Deadline</span>
                    <strong>
                      {selectedProduct.deadline
                        ? new Date(selectedProduct.deadline).toLocaleDateString(
                            "en-IN",
                            { day: "numeric", month: "short", year: "numeric" }
                          )
                        : "7 Days"}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="detail-action-buttons">
                {selectedProduct.hasJoined ? (
                  <div className="already-joined-banner">
                    <span>✓ You have joined this group deal!</span>
                    <button
                      className="primary-button checkout-now-btn"
                      onClick={() => startCheckout(selectedProduct)}
                    >
                      Demo Checkout (₹{selectedProduct.groupPrice}) →
                    </button>
                  </div>
                ) : (
                  <button
                    className="primary-button detail-join-btn"
                    onClick={() => joinDeal(selectedProduct._id)}
                    disabled={
                      selectedProduct.status === "expired" ||
                      selectedProduct.joinedBuyers >= selectedProduct.targetBuyers ||
                      joiningId === selectedProduct._id
                    }
                  >
                    {joiningId === selectedProduct._id
                      ? "Joining Deal..."
                      : selectedProduct.status === "expired"
                        ? "Deal Expired"
                        : selectedProduct.joinedBuyers >=
                            selectedProduct.targetBuyers
                          ? "Target Reached"
                          : "Join Group Deal & Lock ₹" +
                            (
                              Number(selectedProduct.retailPrice) -
                              Number(selectedProduct.groupPrice)
                            ).toLocaleString("en-IN") +
                            " Discount →"}
                  </button>
                )}

                <button
                  className="secondary-button detail-buy-direct-btn"
                  onClick={() => startCheckout(selectedProduct)}
                >
                  Buy Now at Group Price (Demo)
                </button>

                <button
                  className="outline-button share-btn"
                  onClick={() => {
                    navigator.clipboard?.writeText(window.location.href);
                    showToast("Deal link copied to clipboard!", "success");
                  }}
                >
                  🔗 Share Deal With Friends
                </button>
              </div>
            </div>
          </div>
        </main>
      )}

      {/* ============================================================ */}
      {/* VIEW 2: DEMO CHECKOUT & PAYMENT */}
      {/* ============================================================ */}
      {currentView === "checkout" && selectedProduct && (
        <main className="checkout-view">
          <div className="checkout-header-row">
            <div>
              <a
                href="#back"
                className="back-store-link"
                onClick={(e) => {
                  e.preventDefault();
                  navigateTo("marketplace");
                }}
              >
                ← Back to Marketplace
              </a>
              <h2>Demo Group Order Checkout</h2>
              <p>Complete your group buying purchase with simulated payment</p>
            </div>
          </div>

          <div className="checkout-layout">
            {/* Left: Shipping & Payment Form */}
            <div className="checkout-form-card">
              <div className="demo-simulation-banner">
                <span className="demo-badge">SIMULATED PAYMENT MODE</span>
                <h4>Safe Academic Demonstration</h4>
                <p>
                  This checkout is fully interactive for college project
                  evaluation. No real money or card details are charged or
                  stored.
                </p>
              </div>

              <form onSubmit={handlePlaceOrder}>
                <h3 className="checkout-section-title">1. Delivery Address</h3>
                <div className="form-group">
                  <label>Full Street Address *</label>
                  <input
                    type="text"
                    required
                    placeholder="House / Flat No., Street, Landmark"
                    value={checkoutShipping.street}
                    onChange={(e) =>
                      setCheckoutShipping((prev) => ({
                        ...prev,
                        street: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>City *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Bangalore"
                      value={checkoutShipping.city}
                      onChange={(e) =>
                        setCheckoutShipping((prev) => ({
                          ...prev,
                          city: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label>State *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Karnataka"
                      value={checkoutShipping.state}
                      onChange={(e) =>
                        setCheckoutShipping((prev) => ({
                          ...prev,
                          state: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label>Pincode *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 560001"
                      value={checkoutShipping.pincode}
                      onChange={(e) =>
                        setCheckoutShipping((prev) => ({
                          ...prev,
                          pincode: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Contact Phone Number *</label>
                  <input
                    type="tel"
                    required
                    placeholder="10-digit mobile number"
                    value={checkoutShipping.phone}
                    onChange={(e) =>
                      setCheckoutShipping((prev) => ({
                        ...prev,
                        phone: e.target.value,
                      }))
                    }
                  />
                </div>

                <h3 className="checkout-section-title">
                  2. Select Simulated Payment Method
                </h3>
                <div className="payment-options">
                  <label
                    className={`payment-option ${
                      checkoutPaymentMethod.includes("UPI") ? "selected" : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment"
                      value="Simulated UPI (Google Pay / PhonePe)"
                      checked={checkoutPaymentMethod.includes("UPI")}
                      onChange={(e) => setCheckoutPaymentMethod(e.target.value)}
                    />
                    <div>
                      <strong>⚡ Simulated Instant UPI</strong>
                      <p>Google Pay, PhonePe, Paytm, BHIM</p>
                    </div>
                  </label>

                  <label
                    className={`payment-option ${
                      checkoutPaymentMethod.includes("Card") ? "selected" : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment"
                      value="Simulated Card (Visa / Mastercard)"
                      checked={checkoutPaymentMethod.includes("Card")}
                      onChange={(e) => setCheckoutPaymentMethod(e.target.value)}
                    />
                    <div>
                      <strong>💳 Simulated Credit / Debit Card</strong>
                      <p>Visa, MasterCard, RuPay (Test Mode)</p>
                    </div>
                  </label>

                  <label
                    className={`payment-option ${
                      checkoutPaymentMethod.includes("Delivery") ? "selected" : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment"
                      value="Cash on Delivery (Demo)"
                      checked={checkoutPaymentMethod.includes("Delivery")}
                      onChange={(e) => setCheckoutPaymentMethod(e.target.value)}
                    />
                    <div>
                      <strong>💵 Cash on Delivery (Demo)</strong>
                      <p>Pay upon package arrival</p>
                    </div>
                  </label>
                </div>

                <button
                  type="submit"
                  className="primary-button place-order-btn"
                  disabled={checkoutLoading}
                >
                  {checkoutLoading
                    ? "Simulating Payment & Generating Order..."
                    : `Confirm & Place Demo Order (₹${(
                        Number(selectedProduct.groupPrice) * checkoutQty
                      ).toLocaleString("en-IN")}) →`}
                </button>
              </form>
            </div>

            {/* Right: Order Summary */}
            <div className="checkout-summary-card">
              <h3>Order Summary</h3>

              <div className="summary-item-preview">
                {selectedProduct.image ? (
                  <img
                    src={selectedProduct.image}
                    alt={selectedProduct.name}
                    className="summary-thumb"
                  />
                ) : (
                  <div className="summary-thumb-fallback">🛍️</div>
                )}
                <div>
                  <h4>{selectedProduct.name}</h4>
                  <span className="category-pill">
                    {selectedProduct.category || "General"}
                  </span>
                </div>
              </div>

              {/* Quantity selector */}
              <div className="qty-row">
                <span>Quantity</span>
                <div className="qty-controls">
                  <button
                    type="button"
                    onClick={() => setCheckoutQty((q) => Math.max(1, q - 1))}
                    disabled={checkoutQty <= 1}
                  >
                    -
                  </button>
                  <span className="qty-value">{checkoutQty}</span>
                  <button
                    type="button"
                    onClick={() => setCheckoutQty((q) => q + 1)}
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="summary-calc-breakdown">
                <div className="calc-row">
                  <span>
                    Retail Price ({checkoutQty} × ₹{selectedProduct.retailPrice})
                  </span>
                  <span>
                    ₹
                    {(
                      Number(selectedProduct.retailPrice) * checkoutQty
                    ).toLocaleString("en-IN")}
                  </span>
                </div>

                <div className="calc-row green-text">
                  <span>Group Buying Discount</span>
                  <span>
                    - ₹
                    {(
                      (Number(selectedProduct.retailPrice) -
                        Number(selectedProduct.groupPrice)) *
                      checkoutQty
                    ).toLocaleString("en-IN")}
                  </span>
                </div>

                <div className="calc-row">
                  <span>Delivery Charges</span>
                  <span className="green-text">FREE</span>
                </div>

                <hr className="summary-divider" />

                <div className="calc-row total-row">
                  <strong>Total Amount Payable</strong>
                  <strong className="green-text">
                    ₹
                    {(
                      Number(selectedProduct.groupPrice) * checkoutQty
                    ).toLocaleString("en-IN")}
                  </strong>
                </div>

                <div className="savings-highlight-callout">
                  🎉 Total Savings: ₹
                  {(
                    (Number(selectedProduct.retailPrice) -
                      Number(selectedProduct.groupPrice)) *
                    checkoutQty
                  ).toLocaleString("en-IN")}
                </div>
              </div>
            </div>
          </div>
        </main>
      )}

      {/* ============================================================ */}
      {/* VIEW 3: ORDER SUCCESS PAGE */}
      {/* ============================================================ */}
      {currentView === "order-success" && lastPlacedOrder && (
        <main className="order-success-view">
          <div className="order-success-card">
            <div className="success-icon-animated">🎉</div>
            <span className="demo-badge">ORDER CONFIRMED</span>
            <h2>Thank You for Buying Together!</h2>
            <p className="success-subtitle">
              Your group buying order has been placed and confirmed successfully.
            </p>

            <div className="order-receipt-box">
              <div className="receipt-row">
                <span>Order Reference ID</span>
                <strong className="order-code">{lastPlacedOrder.orderId}</strong>
              </div>
              <div className="receipt-row">
                <span>Product</span>
                <strong>
                  {lastPlacedOrder.productName} (×{lastPlacedOrder.quantity})
                </strong>
              </div>
              <div className="receipt-row">
                <span>Amount Paid</span>
                <strong className="green-text">
                  ₹{Number(lastPlacedOrder.totalAmount).toLocaleString("en-IN")}
                </strong>
              </div>
              <div className="receipt-row">
                <span>You Saved</span>
                <strong className="savings-pill">
                  ₹{Number(lastPlacedOrder.savings).toLocaleString("en-IN")}
                </strong>
              </div>
              <div className="receipt-row">
                <span>Payment Method</span>
                <span>{lastPlacedOrder.paymentMethod}</span>
              </div>
              <div className="receipt-row">
                <span>Estimated Delivery</span>
                <span>3 - 5 business days</span>
              </div>
            </div>

            <div className="success-actions">
              <button
                className="primary-button"
                onClick={() => {
                  navigateTo("dashboard");
                  setDashboardTab("orders");
                }}
              >
                Track in Customer Dashboard →
              </button>
              <button
                className="secondary-button"
                onClick={() => navigateTo("marketplace")}
              >
                Continue Shopping
              </button>
            </div>
          </div>
        </main>
      )}

      {/* ============================================================ */}
      {/* VIEW 4: CUSTOMER DASHBOARD */}
      {/* ============================================================ */}
      {currentView === "dashboard" && customerUser && (
        <main className="customer-dashboard-view">
          <div className="dashboard-header">
            <div className="dashboard-user-greeting">
              <div className="user-avatar-circle-lg">
                {customerUser.name ? customerUser.name[0].toUpperCase() : "U"}
              </div>
              <div>
                <h2>Hello, {customerUser.name}!</h2>
                <p>
                  Member since{" "}
                  {customerUser.createdAt
                    ? new Date(customerUser.createdAt).toLocaleDateString()
                    : "Recently"}
                </p>
              </div>
            </div>

            <button
              className="secondary-button"
              onClick={() => navigateTo("marketplace")}
            >
              Browse More Deals
            </button>
          </div>

          {/* Dashboard Tabs */}
          <div className="dashboard-tabs">
            <button
              className={`dashboard-tab-btn ${
                dashboardTab === "deals" ? "active" : ""
              }`}
              onClick={() => setDashboardTab("deals")}
            >
              👥 My Group Deals ({myDeals.length})
            </button>
            <button
              className={`dashboard-tab-btn ${
                dashboardTab === "orders" ? "active" : ""
              }`}
              onClick={() => setDashboardTab("orders")}
            >
              📦 Order History ({myOrders.length})
            </button>
            <button
              className={`dashboard-tab-btn ${
                dashboardTab === "profile" ? "active" : ""
              }`}
              onClick={() => setDashboardTab("profile")}
            >
              👤 Profile & Shipping Address
            </button>
          </div>

          {/* TAB 1: MY GROUP DEALS */}
          {dashboardTab === "deals" && (
            <div className="dashboard-content-panel">
              <div className="panel-title-row">
                <div>
                  <h3>Deals You Have Joined</h3>
                  <p>Track group buyer progress and locked discounts</p>
                </div>
              </div>

              {myDeals.length === 0 ? (
                <div className="status-message">
                  <div className="status-icon">🛍️</div>
                  <h3>No group deals joined yet</h3>
                  <p>
                    Explore live deals on the homepage and join other buyers to
                    save together.
                  </p>
                  <button
                    className="primary-button"
                    onClick={() => navigateTo("marketplace")}
                  >
                    Explore Deals Now
                  </button>
                </div>
              ) : (
                <div className="my-deals-grid">
                  {myDeals.map((deal) => {
                    return (
                      <div key={deal._id} className="my-deal-card">
                        <div className="my-deal-image-wrap">
                          {deal.image ? (
                            <img
                              src={deal.image}
                              alt={deal.name}
                              className="my-deal-thumb"
                            />
                          ) : (
                            <div className="my-deal-thumb-fallback">🛍️</div>
                          )}
                          <span
                            className={`deal-status-badge badge-${deal.status || "active"}`}
                          >
                            {deal.status === "successful"
                              ? "Target Reached!"
                              : deal.status === "expired"
                                ? "Expired"
                                : "Active Deal"}
                          </span>
                        </div>

                        <div className="my-deal-body">
                          <h4>{deal.name}</h4>
                          <span className="category-pill">{deal.category}</span>

                          <div className="price-row-mini">
                            <span className="green-text">
                              <strong>
                                ₹
                                {Number(deal.groupPrice).toLocaleString("en-IN")}
                              </strong>
                            </span>
                            <span className="retail-strike">
                              ₹
                              {Number(deal.retailPrice).toLocaleString("en-IN")}
                            </span>
                            <span className="savings-chip">
                              Save ₹
                              {Number(deal.savings).toLocaleString("en-IN")}
                            </span>
                          </div>

                          <div className="progress-section">
                            <div className="progress-info">
                              <span>
                                {deal.joinedBuyers} of {deal.targetBuyers} buyers
                              </span>
                              <strong>{deal.progress}%</strong>
                            </div>
                            <div className="progress-track">
                              <div
                                className="progress-fill"
                                style={{ width: `${deal.progress}%` }}
                              />
                            </div>
                          </div>

                          <div className="my-deal-actions">
                            <button
                              className="primary-button mini-btn"
                              onClick={() => {
                                const prod = products.find(
                                  (p) => p._id === deal._id
                                );
                                startCheckout(prod || deal);
                              }}
                            >
                              Checkout (₹{deal.groupPrice})
                            </button>
                            <button
                              className="secondary-button mini-btn"
                              onClick={() => {
                                const prod = products.find(
                                  (p) => p._id === deal._id
                                );
                                navigateTo("product-detail", prod || deal);
                              }}
                            >
                              View Deal
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ORDER HISTORY */}
          {dashboardTab === "orders" && (
            <div className="dashboard-content-panel">
              <div className="panel-title-row">
                <div>
                  <h3>Your Orders & Delivery History</h3>
                  <p>View all orders placed through group buying</p>
                </div>
              </div>

              {myOrders.length === 0 ? (
                <div className="status-message">
                  <div className="status-icon">📦</div>
                  <h3>No orders placed yet</h3>
                  <p>Join group deals or checkout at special group rates.</p>
                  <button
                    className="primary-button"
                    onClick={() => navigateTo("marketplace")}
                  >
                    Start Shopping
                  </button>
                </div>
              ) : (
                <div className="customer-orders-list">
                  {myOrders.map((order) => (
                    <div key={order._id} className="order-history-card">
                      <div className="order-card-top">
                        <div>
                          <strong className="order-code">
                            {order.orderId}
                          </strong>
                          <span className="order-date-text">
                            Placed on{" "}
                            {new Date(order.orderDate).toLocaleDateString(
                              "en-IN",
                              {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              }
                            )}
                          </span>
                        </div>
                        <span
                          className={`order-status-badge badge-${order.orderStatus.toLowerCase()}`}
                        >
                          {order.orderStatus}
                        </span>
                      </div>

                      <div className="order-card-body">
                        <div className="order-product-preview">
                          {order.productImage ? (
                            <img
                              src={order.productImage}
                              alt={order.productName}
                              className="order-thumb"
                            />
                          ) : (
                            <div className="order-thumb-fallback">🛍️</div>
                          )}
                          <div>
                            <h4>{order.productName}</h4>
                            <p>
                              Qty: {order.quantity} • Paid via{" "}
                              {order.paymentMethod}
                            </p>
                          </div>
                        </div>

                        <div className="order-pricing-summary">
                          <div>
                            <span className="price-label">Total Paid</span>
                            <strong className="green-text order-amount">
                              ₹
                              {Number(order.totalAmount).toLocaleString("en-IN")}
                            </strong>
                          </div>
                          <div>
                            <span className="price-label">Savings</span>
                            <span className="savings-chip">
                              ₹{Number(order.savings).toLocaleString("en-IN")}
                            </span>
                          </div>
                        </div>

                        <button
                          className="secondary-button"
                          onClick={() => setSelectedOrderDetails(order)}
                        >
                          View Details & Tracking
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: PROFILE */}
          {dashboardTab === "profile" && (
            <div className="dashboard-content-panel profile-panel">
              <div className="panel-title-row">
                <div>
                  <h3>Personal Profile & Shipping Address</h3>
                  <p>Manage your contact details and default delivery address</p>
                </div>
              </div>

              <form onSubmit={handleSaveProfile} className="profile-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Full Name *</label>
                    <input
                      type="text"
                      required
                      value={profileForm.name}
                      onChange={(e) =>
                        setProfileForm((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label>Registered Email Address</label>
                    <input
                      type="email"
                      disabled
                      value={customerUser.email}
                      className="disabled-input"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Mobile Number</label>
                  <input
                    type="tel"
                    placeholder="e.g. 9876543210"
                    value={profileForm.phone}
                    onChange={(e) =>
                      setProfileForm((prev) => ({
                        ...prev,
                        phone: e.target.value,
                      }))
                    }
                  />
                </div>

                <h4 className="profile-subheading">Default Shipping Address</h4>

                <div className="form-group">
                  <label>Street Address</label>
                  <input
                    type="text"
                    placeholder="House / Flat No., Street, Landmark"
                    value={profileForm.street}
                    onChange={(e) =>
                      setProfileForm((prev) => ({
                        ...prev,
                        street: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>City</label>
                    <input
                      type="text"
                      placeholder="e.g. Bangalore"
                      value={profileForm.city}
                      onChange={(e) =>
                        setProfileForm((prev) => ({
                          ...prev,
                          city: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label>State</label>
                    <input
                      type="text"
                      placeholder="e.g. Karnataka"
                      value={profileForm.state}
                      onChange={(e) =>
                        setProfileForm((prev) => ({
                          ...prev,
                          state: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label>Pincode</label>
                    <input
                      type="text"
                      placeholder="e.g. 560001"
                      value={profileForm.pincode}
                      onChange={(e) =>
                        setProfileForm((prev) => ({
                          ...prev,
                          pincode: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="primary-button save-profile-btn"
                  disabled={profileSaving}
                >
                  {profileSaving ? "Saving..." : "Save Profile Details"}
                </button>
              </form>
            </div>
          )}
        </main>
      )}

      {/* ============================================================ */}
      {/* VIEW 5: MARKETPLACE (HOMEPAGE & PRODUCT LISTING) */}
      {/* ============================================================ */}
      {currentView === "marketplace" && (
        <main>
          {/* Hero Section */}
          <section className="hero" id="home">
            <div className="hero-content">
              <span className="hero-label">
                SMART SHOPPING • SHARED SAVINGS
              </span>

              <h1>
                Buy Together.
                <br />
                <span>Pay Less.</span>
              </h1>

              <p>
                Join forces with other buyers, unlock wholesale group discounts,
                and get premium products for less. No middlemen, just community
                buying power.
              </p>

              <div className="hero-actions">
                <a href="#deals" className="primary-button">
                  Explore Group Deals →
                </a>
                <a href="#how-it-works" className="secondary-button">
                  How It Works
                </a>
              </div>

              <div className="hero-stats">
                <div>
                  <h3>{products.length}+</h3>
                  <p>Active Deals</p>
                </div>
                <div>
                  <h3>Up to 40%</h3>
                  <p>Group Savings</p>
                </div>
                <div>
                  <h3>100%</h3>
                  <p>Verified Quality</p>
                </div>
              </div>
            </div>

            <div className="hero-visual">
              <div className="hero-card">
                <span className="deal-badge">LIVE GROUP DEAL</span>
                <div className="hero-illustration">🛍️</div>
                <h3>Better Prices, Together</h3>
                <p>The more people join, the higher the discount unlocked.</p>
                <div className="hero-card-footer">
                  <span>Community buying</span>
                  <span className="green-dot">● Live deals</span>
                </div>
              </div>

              <div className="floating-card">
                <span className="floating-icon">💰</span>
                <div>
                  <strong>Save together</strong>
                  <p>Shop smarter every day</p>
                </div>
              </div>
            </div>
          </section>

          {/* How It Works Section */}
          <section className="how-section" id="how-it-works">
            <div className="section-heading">
              <span className="section-label">SIMPLE 3-STEP PROCESS</span>
              <h2>How BulkBuy Works</h2>
              <p>Three simple steps to unlock massive group discounts.</p>
            </div>

            <div className="steps-grid">
              <article className="step-card">
                <div className="step-icon">🔎</div>
                <span className="step-number">STEP 01</span>
                <h3>Discover Group Deals</h3>
                <p>
                  Explore handpicked products available at wholesale group
                  rates.
                </p>
              </article>

              <article className="step-card">
                <div className="step-icon">👥</div>
                <span className="step-number">STEP 02</span>
                <h3>Join With Other Buyers</h3>
                <p>
                  One-click join to help the group hit the target buyer count
                  before the deadline.
                </p>
              </article>

              <article className="step-card">
                <div className="step-icon">🎉</div>
                <span className="step-number">STEP 03</span>
                <h3>Unlock Deals & Save</h3>
                <p>
                  Once the buyer quota is reached, orders are unlocked at the
                  discounted group price.
                </p>
              </article>
            </div>
          </section>

          {/* Deals Catalog Section */}
          <section className="deals-section" id="deals">
            <div className="deals-heading">
              <div>
                <span className="section-label">CURATED DEALS</span>
                <h2>Explore Group Deals</h2>
                <p>Find your favourite products and save together.</p>
              </div>

              <div className="product-count">
                <strong>{filteredProducts.length}</strong>
                <span>Products available</span>
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="category-filters-container">
              {categories.map((cat) => (
                <button
                  key={cat}
                  className={`category-filter-btn ${
                    selectedCategory === cat ? "active" : ""
                  }`}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Search Bar */}
            <div className="search-container">
              <span className="search-icon">⌕</span>
              <input
                type="text"
                placeholder="Search products, brands, or categories..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              {search && (
                <button
                  className="clear-search"
                  onClick={() => setSearch("")}
                  type="button"
                >
                  ×
                </button>
              )}
            </div>

            {/* Loading state */}
            {loading && (
              <div className="status-message">
                <div className="loader" />
                <h3>Loading amazing deals...</h3>
                <p>Please wait while we connect to MongoDB.</p>
              </div>
            )}

            {/* Error state */}
            {!loading && error && (
              <div className="status-message error-message">
                <div className="status-icon">⚠️</div>
                <h3>Unable to load deals</h3>
                <p>{error}</p>
                <button
                  className="primary-button"
                  onClick={fetchProducts}
                  type="button"
                >
                  Try Again
                </button>
              </div>
            )}

            {/* Product Grid */}
            {!loading && !error && filteredProducts.length > 0 && (
              <div className="products-grid">
                {filteredProducts.map((product) => {
                  const retailPrice = Number(product.retailPrice) || 0;
                  const groupPrice = Number(product.groupPrice) || 0;
                  const joinedBuyers = Number(product.joinedBuyers) || 0;
                  const targetBuyers = Number(product.targetBuyers) || 1;

                  const savings = Math.max(0, retailPrice - groupPrice);
                  const discount =
                    retailPrice > 0
                      ? Math.round((savings / retailPrice) * 100)
                      : 0;

                  const progress = Math.min(
                    100,
                    Math.round((joinedBuyers / targetBuyers) * 100)
                  );

                  const isFull =
                    product.status === "successful" ||
                    joinedBuyers >= targetBuyers;
                  const isExpired = product.status === "expired";
                  const isJoining = joiningId === product._id;
                  const hasJoined = product.hasJoined;

                  return (
                    <article className="product-card" key={product._id}>
                      <div
                        className="product-image-container"
                        onClick={() =>
                          navigateTo("product-detail", product)
                        }
                      >
                        {product.image ? (
                          <img
                            src={product.image}
                            alt={product.name}
                            className="product-image"
                            loading="lazy"
                          />
                        ) : (
                          <div className="product-image-fallback">🛍️</div>
                        )}

                        {discount > 0 && (
                          <span className="discount-badge">
                            {discount}% OFF
                          </span>
                        )}

                        <span className="category-badge">
                          {product.category || "General"}
                        </span>

                        {hasJoined && (
                          <span className="joined-indicator-badge">
                            ✓ Joined
                          </span>
                        )}
                      </div>

                      <div className="product-details">
                        <h3
                          className="clickable-title"
                          onClick={() =>
                            navigateTo("product-detail", product)
                          }
                        >
                          {product.name}
                        </h3>

                        <p className="product-description">
                          {product.description ||
                            "Join this group deal and save more together."}
                        </p>

                        <div className="price-container">
                          <div>
                            <span className="price-label">Group price</span>
                            <div className="group-price">
                              ₹{groupPrice.toLocaleString("en-IN")}
                            </div>
                          </div>

                          <div className="retail-price-container">
                            <span className="price-label">Retail price</span>
                            <div className="retail-price">
                              ₹{retailPrice.toLocaleString("en-IN")}
                            </div>
                          </div>
                        </div>

                        <div className="savings-banner">
                          <span>🎉 You save</span>
                          <strong>
                            ₹{savings.toLocaleString("en-IN")} ({discount}% off)
                          </strong>
                        </div>

                        {/* Progress Bar */}
                        <div className="progress-section">
                          <div className="progress-info">
                            <span>Group progress</span>
                            <strong>{progress}%</strong>
                          </div>

                          <div
                            className="progress-track"
                            role="progressbar"
                            aria-valuenow={progress}
                            aria-valuemin={0}
                            aria-valuemax={100}
                          >
                            <div
                              className="progress-fill"
                              style={{ width: `${progress}%` }}
                            />
                          </div>

                          <div className="buyer-info">
                            <span>👥 {joinedBuyers} joined</span>
                            <span>{targetBuyers} needed</span>
                          </div>
                        </div>

                        {isFull && (
                          <p className="deal-completed">
                            🎉 Target Reached! Deal Unlocked
                          </p>
                        )}

                        {isExpired && (
                          <p className="deal-expired-text">⏰ Deal Expired</p>
                        )}

                        <div className="card-button-row">
                          <button
                            className="join-button"
                            onClick={() => joinDeal(product._id)}
                            disabled={
                              isFull ||
                              isExpired ||
                              isJoining ||
                              joiningId !== null ||
                              hasJoined
                            }
                            type="button"
                          >
                            {hasJoined
                              ? "Already Joined ✓"
                              : isExpired
                                ? "Deal Expired"
                                : isFull
                                  ? "Deal Completed"
                                  : isJoining
                                    ? "Joining..."
                                    : "Join Group Deal →"}
                          </button>

                          <button
                            className="view-detail-btn"
                            onClick={() =>
                              navigateTo("product-detail", product)
                            }
                            title="View product details and checkout"
                          >
                            Details
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {/* Empty state */}
            {!loading && !error && filteredProducts.length === 0 && (
              <div className="status-message">
                <div className="status-icon">🔎</div>
                <h3>No products found</h3>
                <p>Try searching for a different product or category.</p>
                <button
                  className="primary-button"
                  onClick={() => {
                    setSearch("");
                    setSelectedCategory("All");
                  }}
                  type="button"
                >
                  Show All Products
                </button>
              </div>
            )}
          </section>

          {/* CTA Banner */}
          <section className="cta-section">
            <div className="cta-content">
              <span className="section-label">BETTER TOGETHER</span>
              <h2>Why pay retail when we can buy together?</h2>
              <p>
                Discover exclusive bulk discounts on everyday gadgets,
                appliances, and lifestyle products with your community.
              </p>
              <a href="#deals" className="cta-button">
                Explore All Deals Now →
              </a>
            </div>
          </section>
        </main>
      )}

      {/* Footer */}
      <footer className="footer">
        <a
          href="#home"
          className="logo footer-logo"
          onClick={(e) => {
            e.preventDefault();
            navigateTo("marketplace");
          }}
        >
          <span className="logo-icon">B</span>
          <span>
            Bulk<span className="logo-highlight">Buy</span>
          </span>
        </a>

        <p>Buy Together, Pay Less — A Full-Stack Group Buying Marketplace.</p>

        <div className="footer-links-row">
          <button
            className="footer-link-btn"
            onClick={() => navigateTo("marketplace")}
          >
            Marketplace
          </button>
          <span>•</span>
          <button
            className="footer-link-btn"
            onClick={() => {
              if (customerToken) {
                navigateTo("dashboard");
              } else {
                setAuthMode("login");
                setIsAuthModalOpen(true);
              }
            }}
          >
            Customer Dashboard
          </button>
          <span>•</span>
          <button
            className="footer-link-btn"
            onClick={() => navigateTo("admin")}
          >
            Admin Portal
          </button>
        </div>

        <span className="footer-copy">
          © {currentYear} BulkBuy. Developed with React, Node.js,
          Express & MongoDB Atlas.
        </span>
      </footer>

      {/* ============================================================ */}
      {/* MODAL 1: CUSTOMER LOGIN / REGISTER MODAL */}
      {/* ============================================================ */}
      {isAuthModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card auth-modal-card">
            <div className="modal-header">
              <div className="auth-tab-switcher">
                <button
                  type="button"
                  className={`auth-switcher-btn ${
                    authMode === "login" ? "active" : ""
                  }`}
                  onClick={() => {
                    setAuthMode("login");
                    setAuthError("");
                  }}
                >
                  Customer Login
                </button>
                <button
                  type="button"
                  className={`auth-switcher-btn ${
                    authMode === "register" ? "active" : ""
                  }`}
                  onClick={() => {
                    setAuthMode("register");
                    setAuthError("");
                  }}
                >
                  Create Account
                </button>
              </div>

              <button
                className="modal-close-btn"
                onClick={() => setIsAuthModalOpen(false)}
              >
                ✕
              </button>
            </div>

            {authError && (
              <div className="auth-alert error-alert">{authError}</div>
            )}

            {authMode === "login" ? (
              <form onSubmit={handleCustomerLogin} className="auth-form">
                <div className="form-group">
                  <label>Email Address</label>
                  <input
                    type="email"
                    required
                    placeholder="name@example.com"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Password</label>
                  <input
                    type="password"
                    required
                    placeholder="Enter your password"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  className="primary-button auth-submit-btn"
                  disabled={authLoading}
                >
                  {authLoading ? "Logging in..." : "Sign In to BulkBuy →"}
                </button>

                <p className="auth-toggle-note">
                  Don't have an account?{" "}
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => {
                      setAuthMode("register");
                      setAuthError("");
                    }}
                  >
                    Register here
                  </button>
                </p>
              </form>
            ) : (
              <form onSubmit={handleCustomerRegister} className="auth-form">
                <div className="form-group">
                  <label>Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rahul Sharma"
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="name@example.com"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Password (min 6 chars) *</label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label>Mobile Number</label>
                    <input
                      type="tel"
                      placeholder="9876543210"
                      value={authPhone}
                      onChange={(e) => setAuthPhone(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Street Address</label>
                  <input
                    type="text"
                    placeholder="House / Street"
                    value={authStreet}
                    onChange={(e) => setAuthStreet(e.target.value)}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>City</label>
                    <input
                      type="text"
                      placeholder="e.g. Bangalore"
                      value={authCity}
                      onChange={(e) => setAuthCity(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label>State</label>
                    <input
                      type="text"
                      placeholder="e.g. Karnataka"
                      value={authState}
                      onChange={(e) => setAuthState(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label>Pincode</label>
                    <input
                      type="text"
                      placeholder="e.g. 560001"
                      value={authPincode}
                      onChange={(e) => setAuthPincode(e.target.value)}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="primary-button auth-submit-btn"
                  disabled={authLoading}
                >
                  {authLoading ? "Creating account..." : "Complete Registration →"}
                </button>

                <p className="auth-toggle-note">
                  Already have an account?{" "}
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => {
                      setAuthMode("login");
                      setAuthError("");
                    }}
                  >
                    Sign in here
                  </button>
                </p>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 2: ORDER DETAILS MODAL */}
      {/* ============================================================ */}
      {selectedOrderDetails && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Order Tracking & Details</h3>
              <button
                className="modal-close-btn"
                onClick={() => setSelectedOrderDetails(null)}
              >
                ✕
              </button>
            </div>

            <div className="order-details-modal-body">
              <div className="order-details-meta">
                <div>
                  <span className="meta-label">Order Reference ID</span>
                  <strong className="order-code-lg">
                    {selectedOrderDetails.orderId}
                  </strong>
                </div>
                <span
                  className={`order-status-badge badge-${selectedOrderDetails.orderStatus.toLowerCase()}`}
                >
                  {selectedOrderDetails.orderStatus}
                </span>
              </div>

              {/* Status Timeline */}
              <div className="order-timeline">
                {[
                  { key: "Placed", label: "Order Placed" },
                  { key: "Processing", label: "Group Confirmed" },
                  { key: "Shipped", label: "Dispatched" },
                  { key: "Delivered", label: "Delivered" },
                ].map((step, idx) => {
                  const statusOrder = [
                    "Placed",
                    "Processing",
                    "Shipped",
                    "Delivered",
                  ];
                  const currentIdx = statusOrder.indexOf(
                    selectedOrderDetails.orderStatus
                  );
                  const isDone = currentIdx >= idx;
                  return (
                    <div
                      key={step.key}
                      className={`timeline-step ${isDone ? "completed" : ""}`}
                    >
                      <div className="step-circle">{isDone ? "✓" : idx + 1}</div>
                      <span>{step.label}</span>
                    </div>
                  );
                })}
              </div>

              <div className="modal-product-summary">
                {selectedOrderDetails.productImage ? (
                  <img
                    src={selectedOrderDetails.productImage}
                    alt={selectedOrderDetails.productName}
                    className="modal-product-thumb"
                  />
                ) : (
                  <div className="modal-product-thumb-fallback">🛍️</div>
                )}
                <div>
                  <h4>{selectedOrderDetails.productName}</h4>
                  <p>Quantity: {selectedOrderDetails.quantity}</p>
                  <p>
                    Group Price: ₹
                    {Number(selectedOrderDetails.groupPrice).toLocaleString(
                      "en-IN"
                    )}{" "}
                    (Retail: ₹
                    {Number(selectedOrderDetails.retailPrice).toLocaleString(
                      "en-IN"
                    )}
                    )
                  </p>
                </div>
              </div>

              <div className="details-grid-box">
                <div className="details-col">
                  <strong>Delivery Destination</strong>
                  <p>{selectedOrderDetails.customerName}</p>
                  <p>
                    {selectedOrderDetails.shippingAddress?.street},{" "}
                    {selectedOrderDetails.shippingAddress?.city}
                  </p>
                  <p>
                    {selectedOrderDetails.shippingAddress?.state} -{" "}
                    {selectedOrderDetails.shippingAddress?.pincode}
                  </p>
                  <p>Phone: {selectedOrderDetails.customerPhone}</p>
                </div>

                <div className="details-col">
                  <strong>Payment & Savings</strong>
                  <p>Method: {selectedOrderDetails.paymentMethod}</p>
                  <p>Payment Status: {selectedOrderDetails.paymentStatus}</p>
                  <p className="green-text">
                    <strong>
                      Total Paid: ₹
                      {Number(selectedOrderDetails.totalAmount).toLocaleString(
                        "en-IN"
                      )}
                    </strong>
                  </p>
                  <p className="savings-chip">
                    Total Saved: ₹
                    {Number(selectedOrderDetails.savings).toLocaleString(
                      "en-IN"
                    )}
                  </p>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="primary-button"
                onClick={() => setSelectedOrderDetails(null)}
              >
                Close Tracking
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
