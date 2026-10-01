// Express app for the phone shop backend.
//
// This file builds the app only. It does not start a server, so the same app
// can run locally (see server.js) and as a serverless function on Netlify
// (see netlify/functions/api.js). Keep it that way.

const express = require("express");
const cors = require("cors");
const { getCatalog } = require("./catalog");

// Which websites may call this API. The frontend runs on a different address,
// so the browser blocks calls unless we allow the frontend's address here.
// Follows the rule in AGENTS.md section 11: the backend only accepts the
// frontend's domains (plus local development).
const allowedOrigins = (
  process.env.ALLOWED_ORIGINS ||
  "http://localhost:3000,http://127.0.0.1:3000"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const app = express();

app.use(
  cors({
    origin(origin, callback) {
      // Allow tools with no origin (curl, health checks) and known origins.
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
  })
);

app.use(express.json());

// Stage 1 proof route. The frontend fetches this to show the two parts are
// connected. Replace it with the real routes in later stages.
app.get("/hello", (req, res) => {
  res.json({
    message: "Hello from the phone shop backend",
    service: "backend",
    time: new Date().toISOString(),
  });
});

// A tiny health route. Useful for deployment checks and the model service.
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// --- Stage 2: products -----------------------------------------------------

// Lists phones, cheapest first, with optional filters.
//
// Filters are applied by the BACKEND rather than by sending everything and
// letting the browser filter. That keeps the browser fast as the catalog grows
// and means a filter can never be bypassed.
app.get("/products", (req, res) => {
  let products;
  try {
    products = getCatalog();
  } catch (error) {
    return res.status(500).json({
      error: "The product catalog could not be loaded.",
      detail: error.message,
    });
  }

  const { min_price, max_price, brand, in_stock, search } = req.query;

  // A bad number is a client mistake, so say so instead of silently ignoring it.
  const parseBound = (value, name) => {
    if (value === undefined) return null;
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) {
      const error = new Error(`\`${name}\` must be a number of naira, got "${value}".`);
      error.status = 400;
      throw error;
    }
    return n;
  };

  try {
    const min = parseBound(min_price, "min_price");
    const max = parseBound(max_price, "max_price");

    let rows = products.filter((p) => p.active);

    if (min !== null) rows = rows.filter((p) => p.price_ngn >= min);
    if (max !== null) rows = rows.filter((p) => p.price_ngn <= max);
    if (brand) rows = rows.filter((p) => p.brand === brand);
    if (in_stock === "true") rows = rows.filter((p) => p.stock > 0);
    if (search) {
      const q = String(search).toLowerCase();
      rows = rows.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          String(p.processor || "").toLowerCase().includes(q)
      );
    }

    // Cheapest first, so the product list has a predictable order.
    rows = rows.slice().sort((a, b) => a.price_ngn - b.price_ngn);

    // The full list of brands, so the filter UI never invents an option that
    // would return nothing.
    const brands = [...new Set(products.filter((p) => p.active).map((p) => p.brand))].sort();

    res.json({ count: rows.length, total: products.length, brands, products: rows });
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message });
  }
});

// One phone by id. 404 with a clear message, because the frontend links to
// product pages directly and a wrong id should not look like a broken site.
app.get("/products/:id", (req, res) => {
  let products;
  try {
    products = getCatalog();
  } catch (error) {
    return res.status(500).json({ error: "The product catalog could not be loaded." });
  }

  const product = products.find((p) => p.product_id === req.params.id);
  if (!product) {
    return res.status(404).json({ error: `No phone with id "${req.params.id}".` });
  }
  res.json({ product });
});

// Any unknown /api route gets a clear 404 instead of a vague error.
app.use((req, res) => {
  res.status(404).json({ error: "Not found", path: req.originalUrl });
});

module.exports = app;
