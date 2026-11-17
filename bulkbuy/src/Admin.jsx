
import React, { useEffect, useState } from "react";

const API = "/api";

const emptyForm = {
  name: "",
  description: "",
  retailPrice: "",
  groupPrice: "",
  targetBuyers: "",
  category: "General",
  image: "",
};

export default function Admin() {
  const [token, setToken] = useState(
    localStorage.getItem("bulkbuy_admin_token") || ""
  );
  const [email, setEmail] = useState("admin@bulkbuy.com");
  const [password, setPassword] = useState("");
  const [products, setProducts] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  async function login(e) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(`${API}/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Login failed");
      }

      localStorage.setItem("bulkbuy_admin_token", data.token);
      setToken(data.token);
      setPassword("");
      setMessage("Login successful!");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadProducts() {
    try {
      const response = await fetch(`${API}/products`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Could not load products");
      }

      setProducts(Array.isArray(data) ? data : []);
    } catch (error) {
      setMessage(error.message);
    }
  }

  useEffect(() => {
    if (token) {
      loadProducts();
    }
  }, [token]);

  function logout() {
    localStorage.removeItem("bulkbuy_admin_token");
    setToken("");
    setProducts([]);
    setForm(emptyForm);
    setEditingId(null);
    setMessage("Logged out successfully.");
  }

  async function saveProduct(e) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const url = editingId
        ? `${API}/products/${editingId}`
        : `${API}/products`;

      const response = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...form,
          retailPrice: Number(form.retailPrice),
          groupPrice: Number(form.groupPrice),
          targetBuyers: Number(form.targetBuyers),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Could not save product");
      }

      setMessage(data.message || "Product saved successfully!");
      setForm(emptyForm);
      setEditingId(null);
      await loadProducts();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  function editProduct(product) {
    setEditingId(product._id);
    setForm({
      name: product.name || "",
      description: product.description || "",
      retailPrice: product.retailPrice ?? "",
      groupPrice: product.groupPrice ?? "",
      targetBuyers: product.targetBuyers ?? "",
      category: product.category || "General",
      image: product.image || "",
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteProduct(id) {
    if (!window.confirm("Are you sure you want to delete this product?")) {
      return;
    }

    try {
      const response = await fetch(`${API}/products/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Could not delete product");
      }

      setMessage(data.message || "Product deleted successfully!");
      await loadProducts();
    } catch (error) {
      setMessage(error.message);
    }
  }

  if (!token) {
    return (
      <main style={styles.page}>
        <form onSubmit={login} style={styles.loginCard}>
          <h1 style={styles.logo}>BulkBuy</h1>
          <p style={styles.subtitle}>ADMIN PORTAL</p>
          <h2>Welcome Back</h2>
          <p>Sign in to manage your marketplace.</p>

          <label>Email</label>
          <input
            style={styles.input}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <label>Password</label>
          <input
            style={styles.input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button
            type="submit"
            style={styles.primaryButton}
            disabled={loading}
          >
            {loading ? "Signing in..." : "Login to Dashboard"}
          </button>

          {message && <p>{message}</p>}
        </form>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.logo}>BulkBuy</h1>
          <p>Marketplace Administration</p>
        </div>

        <button onClick={logout} style={styles.logoutButton}>
          Logout
        </button>
      </header>

      <section style={styles.stats}>
        <div style={styles.statCard}>
          <h3>Total Products</h3>
          <h1>{products.length}</h1>
        </div>

        <div style={styles.statCard}>
          <h3>Total Buyers Joined</h3>
          <h1>
            {products.reduce(
              (sum, product) => sum + (product.joinedBuyers || 0),
              0
            )}
          </h1>
        </div>

        <div style={styles.statCard}>
          <h3>Active Deals</h3>
          <h1>
            {
              products.filter(
                (product) =>
                  product.joinedBuyers < product.targetBuyers
              ).length
            }
          </h1>
        </div>
      </section>

      <section style={styles.card}>
        <h2>{editingId ? "Edit Product" : "Add New Product"}</h2>

        <form onSubmit={saveProduct} style={styles.form}>
          <input
            style={styles.input}
            placeholder="Product name"
            value={form.name}
            onChange={(e) =>
              setForm({ ...form, name: e.target.value })
            }
            required
          />

          <textarea
            style={styles.input}
            placeholder="Product description"
            value={form.description}
            onChange={(e) =>
              setForm({ ...form, description: e.target.value })
            }
          />

          <input
            style={styles.input}
            placeholder="Retail price (₹)"
            type="number"
            min="0"
            step="0.01"
            value={form.retailPrice}
            onChange={(e) =>
              setForm({ ...form, retailPrice: e.target.value })
            }
            required
          />

          <input
            style={styles.input}
            placeholder="Group price (₹)"
            type="number"
            min="0"
            step="0.01"
            value={form.groupPrice}
            onChange={(e) =>
              setForm({ ...form, groupPrice: e.target.value })
            }
            required
          />

          <input
            style={styles.input}
            placeholder="Target buyers"
            type="number"
            min="1"
            step="1"
            value={form.targetBuyers}
            onChange={(e) =>
              setForm({ ...form, targetBuyers: e.target.value })
            }
            required
          />

          <input
            style={styles.input}
            placeholder="Category"
            value={form.category}
            onChange={(e) =>
              setForm({ ...form, category: e.target.value })
            }
          />

          <input
            style={styles.input}
            placeholder="Image URL (optional)"
            value={form.image}
            onChange={(e) =>
              setForm({ ...form, image: e.target.value })
            }
          />

          <button
            type="submit"
            style={styles.primaryButton}
            disabled={loading}
          >
            {loading
              ? "Saving..."
              : editingId
              ? "Update Product"
              : "Add Product"}
          </button>

          {editingId && (
            <button
              type="button"
              style={styles.logoutButton}
              onClick={() => {
                setEditingId(null);
                setForm(emptyForm);
              }}
            >
              Cancel Editing
            </button>
          )}
        </form>

        {message && <p>{message}</p>}
      </section>

      <section style={styles.card}>
        <h2>Manage Products</h2>

        {products.length === 0 ? (
          <p>No products available yet.</p>
        ) : (
          products.map((product) => (
            <article key={product._id} style={styles.product}>
              <div>
                <h3>{product.name}</h3>
                <p>{product.category}</p>
                <p>Retail: ₹{product.retailPrice}</p>
                <p>Group: ₹{product.groupPrice}</p>
                <p>
                  Buyers: {product.joinedBuyers}/
                  {product.targetBuyers}
                </p>

                <progress
                  value={product.joinedBuyers}
                  max={product.targetBuyers}
                  style={{ width: "100%" }}
                />
              </div>

              <div style={styles.actions}>
                <button
                  style={styles.editButton}
                  onClick={() => editProduct(product)}
                >
                  Edit
                </button>

                <button
                  style={styles.deleteButton}
                  onClick={() => deleteProduct(product._id)}
                >
                  Delete
                </button>
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f4f6f8",
    padding: "30px",
    fontFamily: "Arial, sans-serif",
    color: "#17202a",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "30px",
  },
  logo: {
    color: "#176b45",
    margin: 0,
  },
  subtitle: {
    letterSpacing: "3px",
    color: "#777",
  },
  loginCard: {
    maxWidth: "420px",
    margin: "70px auto",
    padding: "35px",
    background: "white",
    borderRadius: "15px",
    boxShadow: "0 5px 25px #00000012",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  stats: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "18px",
    marginBottom: "25px",
  },
  statCard: {
    background: "white",
    padding: "20px",
    borderRadius: "12px",
  },
  card: {
    background: "white",
    padding: "25px",
    borderRadius: "12px",
    marginBottom: "25px",
  },
  form: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "14px",
  },
  input: {
    padding: "13px",
    border: "1px solid #ddd",
    borderRadius: "7px",
    fontSize: "15px",
    width: "100%",
    boxSizing: "border-box",
  },
  primaryButton: {
    background: "#176b45",
    color: "white",
    padding: "14px",
    border: "none",
    borderRadius: "7px",
    cursor: "pointer",
    fontWeight: "bold",
  },
  logoutButton: {
    background: "#333",
    color: "white",
    padding: "12px 18px",
    border: "none",
    borderRadius: "7px",
    cursor: "pointer",
  },
  product: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "20px",
    padding: "20px 0",
    borderBottom: "1px solid #eee",
  },
  actions: {
    display: "flex",
    gap: "10px",
  },
  editButton: {
    background: "#e6a23c",
    color: "white",
    border: "none",
    padding: "10px 15px",
    borderRadius: "6px",
    cursor: "pointer",
  },
  deleteButton: {
    background: "#d9534f",
    color: "white",
    border: "none",
    padding: "10px 15px",
    borderRadius: "6px",
    cursor: "pointer",
  },
};
