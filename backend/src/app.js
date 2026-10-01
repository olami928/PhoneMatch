// Express app for the phone shop backend.
//
// This file builds the app only. It does not start a server, so the same app
// can run locally (see server.js) and as a serverless function on Netlify
// (see netlify/functions/api.js). Keep it that way.

const express = require("express");
const cors = require("cors");

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

// Any unknown /api route gets a clear 404 instead of a vague error.
app.use((req, res) => {
  res.status(404).json({ error: "Not found", path: req.originalUrl });
});

module.exports = app;
