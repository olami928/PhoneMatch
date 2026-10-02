// catalog.js
//
// Loads the launch catalog from model/data/phones.csv.
//
// WHY THIS EXISTS: Stage 2 needs a product list to browse. The database
// (Supabase) does not arrive until Stage 3, so for now the backend reads the
// same CSV the model reads. That is deliberate: one source of truth, so a
// product_id here always exists in the model's catalog and vice versa.
//
// The file is read once and cached, because a Netlify cold start already costs
// seconds (D35) and re-reading per request would make that worse.

const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
// Where phones.csv lives.
//
// Three candidates, tried in order, because the deploy layout differs from the
// dev layout and a wrong path fails ONLY in production:
//
//   1. CATALOG_PATH env var — an explicit override always wins.
//   2. backend/model_data/phones.csv — the copy made by `npm run
//      sync:model-data`. This is what a Netlify deploy actually contains,
//      because Netlify uses base directory `backend` and esbuild bundles the
//      function, so ../../model/... resolves outside the deployed zip.
//   3. model/data/phones.csv — the real source in a git clone. Kept so a fresh
//      clone works without running the sync script first.
//
// An empty CATALOG_PATH in the environment (common on deploy dashboards) must
// NOT win over the working candidates, or the API would try to read "" and fail.
const CATALOG_CANDIDATES = [
  process.env.CATALOG_PATH,
  path.join(__dirname, "..", "model_data", "phones.csv"),
  path.join(REPO_ROOT, "model", "data", "phones.csv"),
].filter(Boolean);

const CATALOG_PATH = CATALOG_CANDIDATES[0];

// Parses RFC4180 CSV: quoted fields, commas inside quotes, "" escapes, and both
// \n and \r\n line endings. A plain split(",") would corrupt every row whose
// imputed_fields column is a quoted list, which is most of the imputed rows.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') inQuotes = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (ch === "\r") { /* handled by the \n branch */ }
    else field += ch;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }

  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0] !== ""));
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// The CSV holds these specs as floats ("8.0", "256.0") because the M3 builder
// imputed them as medians. That is fine for the model, which only compares them,
// but the description is TEXT a shopper reads, and "8.0GB RAM, 256.0GB storage,
// 5200.0mAh battery" looks like a bug on the product page. Screen size keeps one
// decimal because it genuinely can be fractional (6.78").
function whole(value) {
  const n = toNumber(value);
  return n === null ? null : Math.round(n);
}

function oneDecimal(value) {
  const n = toNumber(value);
  return n === null ? null : Math.round(n * 10) / 10;
}

function loadCatalog() {
  const text = fs.readFileSync(CATALOG_PATH, "utf8");
  const rows = parseCsv(text);
  const header = rows.shift();

  return rows.map((cells) => {
    const raw = {};
    header.forEach((key, i) => { raw[key] = cells[i]; });

    // "none" is the sentinel the builder writes for "nothing was imputed".
    // It must not be reported as a missing field, or every phone in the shop
    // would claim an estimate it does not have.
    const imputed = (raw.imputed_fields || "")
      .split(",")
      .map((f) => f.trim())
      .filter((f) => f && f !== "none");

    return {
      product_id: raw.product_id,
      name: `${raw.brand} ${raw.model}`.trim(),
      brand: raw.brand,
      model: raw.model,
      price_ngn: toNumber(raw.price_ngn),
      price_tier: raw.price_tier,
      condition: raw.condition,
      description:
        `${whole(raw.ram_gb)}GB RAM, ${whole(raw.storage_gb)}GB storage, ` +
        `${whole(raw.battery_mah)}mAh battery, ${whole(raw.main_camera_mp)}MP main camera.`,
      image: null, // no images yet; admin uploads them at Stage 7
      stock: toNumber(raw.stock) ?? 0,
      active: String(raw.active).toLowerCase() === "true",

      // Model features, needed later by /recommend (Stage 10).
      ram_gb: whole(raw.ram_gb),
      storage_gb: whole(raw.storage_gb),
      battery_mah: whole(raw.battery_mah),
      main_camera_mp: whole(raw.main_camera_mp),
      selfie_camera_mp: whole(raw.selfie_camera_mp),
      display_inches: oneDecimal(raw.display_inches),
      refresh_rate_hz: whole(raw.refresh_rate_hz),
      release_year: whole(raw.release_year),
      processor: raw.processor,
      five_g: String(raw.five_g).toLowerCase() === "true",

      // Lets the UI label an estimate instead of presenting it as fact (D24).
      imputed_fields: imputed,
      specs_imputed: imputed.length > 0,
    };
  });
}

let cache = null;

// Loads on first use. Throws loudly if the CSV is missing, so a broken deploy
// is obvious rather than silently showing an empty shop.
function getCatalog() {
  if (!cache) cache = loadCatalog();
  return cache;
}

module.exports = { getCatalog, parseCsv, CATALOG_PATH };
