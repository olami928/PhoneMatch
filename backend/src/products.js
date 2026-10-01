// products.js — reading what the shop can actually sell (finishing Stage 3).
//
// WHY THIS FILE EXISTS: `GET /products` used to read model/data/phones.csv while
// `POST /orders` read the `products` table. Two sources of truth for the same
// question, and they disagreed: a real order decremented stock in the database,
// but the product list kept showing the CSV's number. A shopper could be told
// "in stock" for a phone that had just sold out. The database is now the single
// source of truth for price and stock; the CSV remains the source for the specs
// the MODEL scores, which is a different job.
//
// THE CSV FALLBACK IS DELIBERATE AND LOUD: a fresh clone with no Supabase keys
// must still show a shop rather than an error page, so we fall back to the CSV —
// but we log a warning, because a silent fallback is how the stale-stock bug
// would come back unnoticed.

const { getCatalog } = require("./catalog");
const { supabase, isConfigured } = require("./supabaseClient");

// Every column the shop screens read. Listed explicitly rather than using `*`
// so a column added to the table later cannot silently change the API response.
const COLUMNS =
  "id, name, brand, price_ngn, description, image, stock, active, " +
  "price_tier, condition, ram_gb, storage_gb, battery_mah, main_camera_mp, " +
  "selfie_camera_mp, refresh_rate_hz, display_inches, release_year, processor, " +
  "five_g, imputed_any, imputed_fields";

// Postgres returns `numeric` as a STRING through the REST API ("98100.00").
// Left as a string, a price would render as "98100.00" and a cart total would
// concatenate instead of adding. Everything numeric is converted here, once.
function num(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// Specs stored as Postgres `real` come back as 8, 5000, 50 — but as FLOATs, so
// they render as "8.0GB RAM" and "5000.0mAh" on the product page and in the
// order email. That is a visible regression against the CSV, which held whole
// numbers. These specs are whole numbers in reality (no phone has 8.5GB of RAM),
// so they are rounded here rather than trusting the column type.
function whole(value) {
  const n = num(value);
  return n === null ? null : Math.round(n);
}

// Screen size genuinely can be fractional (6.7"), so it keeps one decimal place
// rather than being rounded to 7.
function oneDecimal(value) {
  const n = num(value);
  return n === null ? null : Math.round(n * 10) / 10;
}

// Turns one database row into the shape the frontend already expects.
//
// The field names deliberately match what catalog.js produced, so no frontend
// screen or normaliser had to change. `product_id` is kept as the public id
// because that is the id the MODEL returns in a recommendation, and it must be
// the same id in both places or a shopper cannot buy what the model suggested.
function toProduct(row) {
  const imputed = String(row.imputed_fields || "")
    .split(",")
    .map((f) => f.trim())
    .filter((f) => f && f !== "none");

  const ram = whole(row.ram_gb);
  const storage = whole(row.storage_gb);
  const battery = whole(row.battery_mah);
  const camera = whole(row.main_camera_mp);

  return {
    product_id: row.id,
    name: row.name,
    brand: row.brand,
    // The table stores the combined `name` (that is what the shop shows) and has
    // no separate `model` column. Kept as null rather than guessed by chopping
    // the brand off the name: "itel A200+" would not survive that. No screen
    // needs it — the results page gets `model` from the model service instead.
    model: null,
    price_ngn: num(row.price_ngn) ?? 0,
    price_tier: row.price_tier,
    condition: row.condition,
    description:
      row.description ||
      `${ram}GB RAM, ${storage}GB storage, ${battery}mAh battery, ${camera}MP main camera.`,
    image: row.image || null,
    stock: num(row.stock) ?? 0,
    active: row.active !== false,
    ram_gb: ram,
    storage_gb: storage,
    battery_mah: battery,
    main_camera_mp: camera,
    selfie_camera_mp: whole(row.selfie_camera_mp),
    display_inches: oneDecimal(row.display_inches),
    refresh_rate_hz: whole(row.refresh_rate_hz),
    release_year: whole(row.release_year),
    processor: row.processor,
    five_g: row.five_g === true,
    imputed_fields: imputed,
    specs_imputed: Boolean(row.imputed_any) || imputed.length > 0,
  };
}

// Search text goes into a PostgREST `or(...)` filter, where commas and
// parentheses are the filter's own syntax. Stripping them means a shopper
// searching for "redmi, samsung" cannot alter the query — the term is data, and
// data must not become syntax.
function safeSearch(term) {
  return String(term).replace(/[,()*%\\]/g, " ").trim();
}

let warnedAboutFallback = false;

// Reads the catalog from the database when it is configured, else from the CSV.
// Returns the rows plus the metadata `GET /products` reports, so the caller
// never has to know which source answered.
async function listProducts(filters = {}) {
  const { min_price, max_price, brand, in_stock, search } = filters;

  if (!isConfigured()) return listFromCsv(filters);

  let query = supabase().from("products").select(COLUMNS);

  // Inactive products are never listed. This is applied in the QUERY, not after
  // it, so an inactive phone cannot leak into the count or the brand list.
  query = query.eq("active", true);
  if (min_price !== null && min_price !== undefined) query = query.gte("price_ngn", min_price);
  if (max_price !== null && max_price !== undefined) query = query.lte("price_ngn", max_price);
  if (brand) query = query.eq("brand", brand);
  if (in_stock === true) query = query.gt("stock", 0);

  const term = search ? safeSearch(search) : "";
  if (term) {
    query = query.or(`name.ilike.%${term}%,processor.ilike.%${term}%`);
  }

  const { data, error } = await query.order("price_ngn", { ascending: true });
  if (error) throw new Error(`Could not read products: ${error.message}`);

  // `total` is how many phones the shop has, not how many matched the filter,
  // which is what lets the UI say "9 of 63 phones".
  const { count: total, error: totalError } = await supabase()
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("active", true);
  if (totalError) throw new Error(`Could not count products: ${totalError.message}`);

  // The brand list comes from the DATABASE, not from a hardcoded array, so it
  // can never offer a brand that returns nothing. Built from all active phones
  // rather than the filtered rows, otherwise choosing one brand would empty the
  // other options in the filter UI.
  const { data: brandRows, error: brandError } = await supabase()
    .from("products")
    .select("brand")
    .eq("active", true);
  if (brandError) throw new Error(`Could not read brands: ${brandError.message}`);

  const brands = [...new Set((brandRows || []).map((r) => r.brand))].sort();

  return {
    products: (data || []).map(toProduct),
    total: total ?? (data || []).length,
    brands,
    source: "database",
  };
}

// One phone, or null. `maybeSingle` rather than `single` so an unknown id is a
// clean null (the route turns that into a 404) instead of a PostgREST error.
async function getProduct(id) {
  if (!isConfigured()) {
    const found = getCatalog().find((p) => p.product_id === id);
    return found || null;
  }

  const { data, error } = await supabase()
    .from("products")
    .select(COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Could not read the product: ${error.message}`);
  return data ? toProduct(data) : null;
}

/**
 * The ids the shop can actually sell right now: active, with stock.
 *
 * This exists because the MODEL reads stock from phones.csv, which never changes
 * when an order is placed. Without this list the model would keep recommending a
 * phone the shop has just sold out of, breaking the rule in AGENTS.md section 8
 * that an out-of-stock phone must never be recommended.
 *
 * Returns `null` when the database is not configured. `null` means "unknown",
 * and the caller must then fall back to the model's own stock column. Returning
 * an empty list instead would silently wipe out every recommendation on a
 * misconfigured deploy.
 */
async function listSellableIds() {
  if (!isConfigured()) return null;

  const { data, error } = await supabase()
    .from("products")
    .select("id")
    .eq("active", true)
    .gt("stock", 0);
  if (error) throw new Error(`Could not read sellable products: ${error.message}`);

  const ids = (data || []).map((r) => r.id);
  // An empty result almost always means a broken query, not an empty shop. It is
  // treated as "unknown" so the model still uses its own stock rather than
  // recommending nothing at all.
  return ids.length ? ids : null;
}

// --- CSV fallback ------------------------------------------------------------
//
// Used only when Supabase is not configured, so a fresh clone still runs. The
// filtering is kept in step with the database path above on purpose: a fallback
// that behaves differently is a fallback that hides bugs.

function listFromCsv({ min_price, max_price, brand, in_stock, search } = {}) {
  if (!warnedAboutFallback) {
    warnedAboutFallback = true;
    console.warn(
      "products: Supabase is not configured, so prices and stock come from " +
        "model/data/phones.csv. Orders will not be saved and stock shown here " +
        "will NOT reflect real orders. Set SUPABASE_URL and SUPABASE_SECRET_KEY."
    );
  }

  const all = getCatalog();
  let rows = all.filter((p) => p.active);

  if (min_price !== null && min_price !== undefined) rows = rows.filter((p) => p.price_ngn >= min_price);
  if (max_price !== null && max_price !== undefined) rows = rows.filter((p) => p.price_ngn <= max_price);
  if (brand) rows = rows.filter((p) => p.brand === brand);
  if (in_stock === true) rows = rows.filter((p) => p.stock > 0);
  if (search) {
    const q = String(search).toLowerCase();
    rows = rows.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        String(p.processor || "").toLowerCase().includes(q)
    );
  }

  rows = rows.slice().sort((a, b) => a.price_ngn - b.price_ngn);
  const brands = [...new Set(all.filter((p) => p.active).map((p) => p.brand))].sort();

  return { products: rows, total: all.filter((p) => p.active).length, brands, source: "csv" };
}

module.exports = { listProducts, getProduct, listSellableIds, toProduct };