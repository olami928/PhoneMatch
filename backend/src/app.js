// Express app for the phone shop backend.
//
// This file builds the app only. It does not start a server, so the same app
// can run locally (see server.js) and as a serverless function on Netlify
// (see netlify/functions/api.js). Keep it that way.

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const products = require("./products");
const auth = require("./auth");
const admin = require("./admin");
const adminOrders = require("./adminOrders");
const orders = require("./orders");
const email = require("./email");

// The frozen questionnaire config. Read once and cached, because it does not
// change while the server runs, and re-reading a file on every request would be
// wasteful for no benefit.
//
// WHY model_data/ IS CHECKED FIRST: in local development the real file at
// model/config/questionnaire_v1.json is the source of truth. But Netlify bundles
// this function with esbuild and deploys with base directory `backend`, so a
// path built from __dirname upwards into ../.. lands outside the deployed zip and
// throws — and only in production, never locally. backend/model_data/ holds a
// byte-identical copy made by `npm run sync:model-data`, and it is what gets
// deployed. Reading it first means one code path works in both places.
//
// The original path is kept as a fallback so a developer who has not run the
// sync script still gets a working local server, with a warning rather than a
// crash.
const QUESTIONNAIRE_CANDIDATES = [
  path.join(__dirname, "..", "model_data", "questionnaire_v1.json"),
  path.join(__dirname, "..", "..", "model", "config", "questionnaire_v1.json"),
];

let questionnaireCache = null;

function readQuestionnaire() {
  if (questionnaireCache) return questionnaireCache;

  const missing = [];
  let raw = null;
  let usedPath = null;

  for (const candidate of QUESTIONNAIRE_CANDIDATES) {
    try {
      raw = fs.readFileSync(candidate, "utf8");
      usedPath = candidate;
      break;
    } catch {
      missing.push(candidate);
    }
  }

  if (raw === null) {
    throw new Error(
      `Could not read the questionnaire config. Tried:\n  - ${missing.join(
        "\n  - "
      )}\nRun: npm run sync:model-data`
    );
  }

  // Only warn when the deployed copy was missing, because that is the situation
  // that means a deploy shipped without running the sync step.
  if (usedPath !== QUESTIONNAIRE_CANDIDATES[0]) {
    console.warn(
      "questionnaire: using the repo copy, not backend/model_data/. Run " +
        "'npm run sync:model-data' before deploying."
    );
  }

  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
    throw new Error(`${usedPath} has no questions.`);
  }
  questionnaireCache = parsed;
  return questionnaireCache;
}

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

// Resolves `req.user` and `req.profile` for EVERY request, when a valid token is
// present. It never blocks a request: guest checkout is allowed (D12), so most
// routes stay public and simply see `req.user === null`. Routes that do need an
// identity use `requireUser` or `requireAdmin`, which read what is set here.
//
// Registered before the routes so every route below can rely on it.
app.use(auth.attachUser);

// --- Stage 6: who am I -------------------------------------------------------
//
// GET /auth/me tells the frontend whether someone is signed in and whether they
// are an admin. The frontend uses it to show the right header, but it is NOT a
// security gate: a caller could lie to their own browser and the only thing that
// matters is that the admin ROUTES below check the role server-side.
app.get("/auth/me", (req, res) => {
  if (!req.user) {
    // 200, not 401. "Not signed in" is a normal answer to this question, and a
    // 401 would make every guest page look like an error to the frontend.
    return res.json({ signed_in: false });
  }
  res.json({
    signed_in: true,
    email: req.user.email || null,
    name:
      req.profile?.full_name ||
      (req.user.user_metadata && req.user.user_metadata.full_name) ||
      null,
    role: req.profile?.role || "customer",
    user_id: req.user.id,
  });
});

// --- Stage 7: admin products -------------------------------------------------
//
// Every route below is behind `requireAdmin`, which runs BEFORE the handler.
// That ordering is the security property: a non-admin is refused before any
// database read happens, so they cannot learn what products exist, let alone
// change one. Hiding the admin links in the UI is not part of this.

// Lists products for admin, including inactive and out-of-stock ones.
app.get("/admin/products", auth.requireAdmin, async (req, res) => {
  try {
    res.json(await admin.listForAdmin());
  } catch (err) {
    console.error("admin listForAdmin failed:", err.message);
    res.status(500).json({ error: "Could not load the product list." });
  }
});

// Adds a product.
app.post("/admin/products", auth.requireAdmin, async (req, res) => {
  try {
    const product = await admin.createProduct(req.body);
    // 201, and the created row back, so the form can show what was actually saved
    // rather than what the browser hoped it sent.
    res.status(201).json({ product });
  } catch (err) {
    if (err instanceof admin.AdminValidationError) {
      return res.status(400).json({ error: err.message });
    }
    console.error("admin createProduct failed:", err.message);
    res.status(500).json({ error: "Could not save the product." });
  }
});

// Edits a product. Feature 19 and feature 20: full spec fields plus stock.
app.put("/admin/products/:id", auth.requireAdmin, async (req, res) => {
  try {
    const product = await admin.updateProduct(req.params.id, req.body);
    res.json({ product });
  } catch (err) {
    if (err instanceof admin.AdminValidationError) {
      // 404 for an unknown id, 400 for bad values: the form shows the message
      // as-is, so it has to be written for a human.
      return res.status(err.message.startsWith("No product") ? 404 : 400).json({
        error: err.message,
      });
    }
    console.error("admin updateProduct failed:", err.message);
    res.status(500).json({ error: "Could not save the product." });
  }
});

// --- Stage 8: admin orders ---------------------------------------------------
//
// Same gate as Stage 7: requireAdmin runs BEFORE the handler, so a non-admin is
// refused before any order is read. An order list holds real customer names,
// emails, phone numbers and addresses, so this is the most sensitive read in
// the whole admin area.

// The status list, served from the backend so the admin dropdown cannot drift
// out of step with what the API accepts. Public shape, no customer data.
app.get("/admin/orders/statuses", (req, res) => {
  res.json({ statuses: adminOrders.STATUSES });
});

// Lists orders. Supports ?status=, ?search= and ?limit=.
app.get("/admin/orders", auth.requireAdmin, async (req, res) => {
  try {
    const [orders, counts] = await Promise.all([
      adminOrders.listOrders({
        status: req.query.status,
        search: req.query.search,
        limit: req.query.limit,
      }),
      adminOrders.statusCounts(),
    ]);
    res.json({ orders, counts });
  } catch (err) {
    if (err instanceof adminOrders.OrderValidationError) {
      return res.status(400).json({ error: err.message });
    }
    console.error("admin listOrders failed:", err.message);
    res.status(500).json({ error: "Could not load the orders." });
  }
});

// One order with its items and history.
app.get("/admin/orders/:id", auth.requireAdmin, async (req, res) => {
  try {
    const detail = await adminOrders.getOrderDetail(req.params.id);
    if (!detail) {
      return res.status(404).json({ error: "No order was found with that reference." });
    }
    res.json(detail);
  } catch (err) {
    console.error("admin getOrderDetail failed:", err.message);
    res.status(500).json({ error: "Could not load the order." });
  }
});

// Changes an order's status. Feature 21.
app.patch("/admin/orders/:id/status", auth.requireAdmin, async (req, res) => {
  try {
    // WHO changed it comes from the verified token, never from the body. A
    // request that tried to set `changed_by` itself is simply ignored.
    const result = await adminOrders.setOrderStatus(
      req.params.id,
      req.body && req.body.status,
      req.user.id
    );

    // The email outcome is logged, never swallowed. A status change that
    // silently failed to notify the customer is the "silent success" trap.
    if (result.changed) {
      if (result.email && result.email.sent) {
        console.log(
          `order ${req.params.id} -> ${result.order.status}; status email sent <${result.email.id}>`
        );
      } else {
        console.warn(
          `order ${req.params.id} -> ${result.order.status}; NO status email ` +
            `(${(result.email && result.email.reason) || "unknown"})`
        );
      }
      for (const r of result.restocked) {
        console.log(`  restocked ${r.product_id} x${r.quantity} -> stock ${r.stock}`);
      }
    }

    res.json({
      order: result.order,
      changed: result.changed,
      restocked: result.restocked,
      email: result.email,
    });
  } catch (err) {
    if (err instanceof adminOrders.OrderValidationError) {
      return res.status(400).json({ error: err.message });
    }
    console.error("admin setOrderStatus failed:", err.message);
    res.status(500).json({ error: "Could not change the order status." });
  }
});

// A deliberately tiny admin route. It exists so the role gate can be TESTED
// end to end without building the whole admin area first, and it is the
// reference example every future admin route copies: `requireAdmin` runs before
// any data is read, so a non-admin never reaches the database.
app.get("/admin/ping", auth.requireAdmin, (req, res) => {
  res.json({
    status: "ok",
    message: "You are signed in as an administrator.",
    email: req.user.email || null,
    role: req.profile.role,
  });
});

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
app.get("/products", async (req, res) => {
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

  let result;
  try {
    const min = parseBound(min_price, "min_price");
    const max = parseBound(max_price, "max_price");

    // Filters go to the DATABASE, not to a list fetched whole and filtered in
    // memory. That keeps the browser fast as the catalog grows and means a
    // filter can never be bypassed by editing the URL.
    result = await products.listProducts({
      min_price: min,
      max_price: max,
      brand: brand || undefined,
      in_stock: in_stock === "true",
      search: search || undefined,
    });
  } catch (error) {
    // A bad query parameter is the CALLER's mistake and its message is already
    // written to be shown as-is ("min_price must be a number of naira, got
    // \"abc\""). It must not be buried inside a generic "could not be loaded",
    // which tells the shopper nothing about what to fix. Anything else really is
    // our fault and gets the generic message.
    if (error.status === 400) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({
      error: "The product list could not be loaded.",
      detail: error.message,
    });
  }

  // `source` tells the operator whether prices came from the live database or
  // the CSV fallback. The frontend does not need it, but it makes a degraded
  // deploy visible in the response instead of only in the server log.
  res.json({
    count: result.products.length,
    total: result.total,
    brands: result.brands,
    source: result.source,
    products: result.products,
  });
});

// One phone by id. 404 with a clear message, because the frontend links to
// product pages directly and a wrong id should not look like a broken site.
app.get("/products/:id", async (req, res) => {
  let product;
  try {
    product = await products.getProduct(req.params.id);
  } catch (error) {
    return res.status(500).json({
      error: "The product could not be loaded.",
      detail: error.message,
    });
  }

  if (!product) {
    return res.status(404).json({ error: `No phone with id "${req.params.id}".` });
  }
  res.json({ product });
});

// Any unknown /api route gets a clear 404 instead of a vague error.
// --- The questionnaire ------------------------------------------------------
//
// The five questions are NOT written here. They live in
// model/config/questionnaire_v1.json, which is the frozen single source of truth
// (D21, and the "keep weights in a config file" model rule). This route only
// reads that file and strips the internal notes, so the wording can be changed
// by the team without touching frontend or backend code.
//
// It mirrors questionnaire_for_frontend() in model/src/questionnaire_mapper.py.
// The internal `why` and `alias_of` keys are stripped here too: they record our
// reasoning for each option and must never reach a shopper's browser.
app.get("/questionnaire", (req, res) => {
  let config;
  try {
    config = readQuestionnaire();
  } catch (error) {
    return res.status(500).json({
      error: "The questionnaire could not be loaded.",
      detail: error.message,
    });
  }

  const questions = config.questions.map((q) => ({
    id: q.id,
    number: q.number,
    question: q.question,
    help: q.help || null,
    required: Boolean(q.required),
    skippable: Boolean(q.skippable),
    options: q.options.map((o) => {
      const clean = {};
      for (const [key, value] of Object.entries(o)) {
        if (key !== "why" && key !== "alias_of") clean[key] = value;
      }
      // The config marks the budget options with a sentinel because budget is
      // the one question whose options are not a plain enum. The UI only needs
      // to know it is a budget question, so it gets a readable value.
      if (clean.value === "__price__") clean.value = "price";
      return clean;
    }),
  }));

  res.json({ version: config.version, questions });
});

// POST /recommend forwards the shopper's 5 answers to the Python model service
// and returns the ranked phones.
//
// WHY A PROXY AND NOT A DIRECT BROWSER CALL: the model service holds a secret
// shared key and lives on a private network. AGENTS.md section 11 says only the
// backend may call it, so the browser never sees its address.
//
// The backend passes the answers straight through and does NOT re-apply the
// budget or storage rules itself. There is one implementation of the rules, in
// the model service; duplicating them here would let the two drift apart and
// could show a shopper a phone the model never approved.
const MODEL_SERVICE_URL =
  process.env.MODEL_SERVICE_URL || "http://localhost:8000";

app.post("/recommend", async (req, res) => {
  const answers = req.body || {};

  // Reject an empty submission early and clearly, rather than forwarding
  // nothing and letting the model return a confusing error.
  const required = ["budget", "main_use", "top_priority", "storage"];
  const missing = required.filter((key) => !answers[key]);
  if (missing.length) {
    return res.status(400).json({
      error: `Missing answers: ${missing.join(", ")}`,
    });
  }

  try {
    // The model reads stock from phones.csv, which never changes when an order
    // is placed. So the backend sends the ids the shop can actually sell RIGHT
    // NOW, read from the `products` table. Without this the model would keep
    // recommending a phone that just sold out.
    //
    // The ids can only ever REMOVE candidates. They are applied by intersecting
    // with the catalog, never by adding to it, so a caller still cannot smuggle
    // an out-of-stock or over-budget phone past the hard filters by naming it.
    // See `apply_available_ids` in shop_recommender.py.
    let sellableIds = null;
    try {
      sellableIds = await products.listSellableIds();
    } catch (err) {
      // Never fail a recommendation because the stock lookup had a problem. The
      // model falls back to its own stock column, which is stale but never
      // empty. This is logged rather than swallowed so it is not invisible.
      console.error("could not read live stock, using the catalog's own:", err.message);
    }

    const response = await fetch(`${MODEL_SERVICE_URL}/recommend`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Shared secret so only this backend can call the model service.
        ...(process.env.MODEL_SERVICE_KEY
          ? { "X-Model-Key": process.env.MODEL_SERVICE_KEY }
          : {}),
      },
      // `available_ids` sits beside the answers, not inside them, so the answer
      // keys stay exactly as the questionnaire produced them. Omitted entirely
      // when unknown rather than sent as [] — an empty list would mean "nothing
      // is sellable" and wipe out every recommendation.
      body: JSON.stringify(
        sellableIds ? { ...answers, available_ids: sellableIds } : answers
      ),
      signal: AbortSignal.timeout(10000),
    });

    const payload = await response.json();

    if (!response.ok) {
      // Bad answers come back as 400 from the model; pass the reason through so
      // the questionnaire can show something useful.
      return res.status(response.status).json({
        error: payload.detail || payload.error || "The model service rejected these answers.",
      });
    }

    res.json(payload);
  } catch (err) {
    // The model service being down must not look like a shopper mistake, so
    // this is a 502 with an honest message rather than a 400.
    console.error("model service unreachable:", err.message);
    res.status(502).json({
      error:
        "Our recommendation model is not available right now. Please try again in a moment.",
    });
  }
});

// Exposes the model version so the shop can show it and log it with a session.
app.get("/model/version", async (req, res) => {
  try {
    const response = await fetch(`${MODEL_SERVICE_URL}/version`, {
      signal: AbortSignal.timeout(5000),
    });
    res.json(await response.json());
  } catch {
    res.status(502).json({ error: "Model service unavailable." });
  }
});

// =========================================================== orders (Stage 5)
//
// POST /orders is the checkout. Guest checkout is allowed (D12), so there is no
// user id here yet; Stage 6 adds it once Google sign-in exists.
//
// The route is deliberately thin. All the rules (what is valid, what a phone
// costs, whether there is stock) live in orders.js, so they can be tested
// without going through HTTP, and so there is exactly one implementation.
app.post("/orders", async (req, res) => {
  if (!orders.isConfigured()) {
    // Say what is wrong instead of returning a generic 500. This is the single
    // most likely cause of a failed checkout during setup.
    return res.status(503).json({
      error:
        "Checkout is not available yet: the shop database is not configured.",
    });
  }

  let order;
  try {
    order = await orders.buildOrder(req.body);
  } catch (err) {
    if (err instanceof orders.ValidationError) {
      // 400: the shopper needs to change something. The message is written to be
      // shown to them as-is.
      return res.status(400).json({ error: err.message });
    }
    console.error("buildOrder failed:", err.message);
    return res.status(500).json({
      error: "We could not read the cart. Please try again.",
    });
  }

  let saved;
  try {
    // Tie the order to the signed-in shopper when there is one, so it appears in
    // their order history. `req.user.id` comes from the VERIFIED token set by
    // attachUser — not from the request body — so nobody can file an order under
    // another account. A guest simply gets null, which is allowed (D12).
    order.user_id = req.user ? req.user.id : null;
    saved = await orders.saveOrder(order);
  } catch (err) {
    console.error("saveOrder failed:", err.message);
    return res.status(500).json({
      error: "We could not save your order. Nothing has been charged.",
    });
  }

  // Emails are sent AFTER the order is safely stored, and a failure to send is
  // logged but never fails the order. Losing a real order because an email
  // server was briefly down would be far worse than a delayed receipt.
  //
  // Each result is logged explicitly. `send()` resolves with { sent: false }
  // instead of throwing when it skips a message, so without this a blocked or
  // unconfigured email looks exactly like a delivered one in the log.
  const emailPayload = { order: { ...order, id: saved.id }, items: order.items };
  const reportEmail = (label, result) => {
    if (result && result.sent) {
      console.log(`  ${label} sent to ${result.to} (${result.id})`);
    } else {
      console.warn(`  ${label} NOT sent to ${(result && result.to) || "unknown"}: ${
        (result && result.reason) || "unknown reason"
      }`);
    }
  };

  email
    .send(email.orderConfirmationEmail(emailPayload))
    .then((r) => reportEmail("order confirmation", r))
    .catch((e) => console.error("confirmation email failed:", e.message));
  email
    .send(email.newOrderAlertEmail(emailPayload))
    .then((r) => reportEmail("admin new-order alert", r))
    .catch((e) => console.error("admin alert email failed:", e.message));

  res.status(201).json({
    order_id: saved.id,
    status: saved.status,
    created_at: saved.created_at,
    email: order.email,
    full_name: order.full_name,
    items: order.items,
    subtotal: order.subtotal,
    delivery: order.delivery,
    total: order.total,
    // If stock moved under us the shopper must be told, not left to discover it
    // when the parcel does not arrive.
    oversold: saved.oversold,
  });
});

// GET /orders/:id powers the confirmation page.
//
// This deliberately returns the order to anyone holding its id and does NOT
// require sign-in. It exposes only what the buyer already supplied (their own
// name, address and email) and is reachable by guessable-looking uuid, so it is
// no more revealing than the order confirmation email itself. When Stage 6 adds
// accounts, this route is where the owner check goes: a signed-in shopper should
// only see their own orders, and guests should get a token in the URL.
app.get("/orders/:id", async (req, res) => {
  if (!orders.isConfigured()) {
    return res.status(503).json({ error: "The shop database is not configured." });
  }
  try {
    const order = await orders.getOrder(req.params.id);
    if (!order) {
      return res.status(404).json({ error: "We could not find that order." });
    }
    res.json({ order });
  } catch (err) {
    console.error("getOrder failed:", err.message);
    res.status(500).json({ error: "We could not load that order." });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: "Not found", path: req.originalUrl });
});

module.exports = app;
