// Express app for the phone shop backend.
//
// This file builds the app only. It does not start a server, so the same app
// can run locally (see server.js) and as a serverless function on Netlify
// (see netlify/functions/api.js). Keep it that way.

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { getCatalog } = require("./catalog");

// The frozen questionnaire config. Read once and cached, because it does not
// change while the server runs, and re-reading a file on every request would be
// wasteful for no benefit.
const QUESTIONNAIRE_PATH = path.join(
  __dirname,
  "..",
  "..",
  "model",
  "config",
  "questionnaire_v1.json"
);

let questionnaireCache = null;

function readQuestionnaire() {
  if (questionnaireCache) return questionnaireCache;
  const raw = fs.readFileSync(QUESTIONNAIRE_PATH, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
    throw new Error(`${QUESTIONNAIRE_PATH} has no questions.`);
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
    const response = await fetch(`${MODEL_SERVICE_URL}/recommend`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Shared secret so only this backend can call the model service.
        ...(process.env.MODEL_SERVICE_KEY
          ? { "X-Model-Key": process.env.MODEL_SERVICE_KEY }
          : {}),
      },
      body: JSON.stringify(answers),
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

app.use((req, res) => {
  res.status(404).json({ error: "Not found", path: req.originalUrl });
});

module.exports = app;
