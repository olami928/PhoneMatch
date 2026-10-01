// admin.js — the admin side: products and stock (Stage 7).
//
// THE RULE FOR EVERY FUNCTION HERE: the database is the only source of truth for
// price and stock (D36). The model reads its specs from phones.csv, so a product
// edited in admin changes what the SHOP shows immediately, while the MODEL keeps
// scoring the CSV's copy of the specs. That is intentional, and it is why the
// imputed_fields column matters: an admin can correct a guessed battery here and
// the shop is honest immediately.
//
// Two guards run on every write, and they are why this file exists at all:
//   1. stock can never go negative (a checkout bug must not become a negative
//      stock number that then reads as "in stock")
//   2. a product with a missing model feature is ALLOWED but FLAGGED, because
//      feature 26 in the PRD asks for a warning rather than a hard block. An admin
//      adding a phone before the model knows it is normal, not a mistake.

const { supabase, isConfigured } = require("./supabaseClient");

// Every column the admin UI can write. Anything not listed cannot be changed
// from the admin area, which stops a crafted request from setting internal
// columns like created_at or id.
const WRITABLE = {
  name: "name",
  brand: "brand",
  price_ngn: "price_ngn",
  description: "description",
  image: "image",
  stock: "stock",
  active: "active",
  price_tier: "price_tier",
  condition: "condition",
  ram_gb: "ram_gb",
  storage_gb: "storage_gb",
  battery_mah: "battery_mah",
  main_camera_mp: "main_camera_mp",
  selfie_camera_mp: "selfie_camera_mp",
  refresh_rate_hz: "refresh_rate_hz",
  display_inches: "display_inches",
  release_year: "release_year",
  processor: "processor",
  five_g: "five_g",
};

// The specs the MODEL needs to score a phone well. A product missing one can
// still be sold, but the model cannot reason about it properly, which is exactly
// the warning feature 26 asks for.
const MODEL_FEATURES = [
  "ram_gb",
  "storage_gb",
  "battery_mah",
  "main_camera_mp",
  "selfie_camera_mp",
  "refresh_rate_hz",
  "display_inches",
  "release_year",
  "processor",
];

// A 400 the admin caused, as opposed to a 500 we caused. The route maps this to
// the right status code and the message is shown in the form as-is.
class AdminValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "AdminValidationError";
    this.status = 400;
  }
}

function requireConfigured() {
  if (!isConfigured()) {
    throw new Error("Supabase is not configured, so admin changes cannot be saved.");
  }
}

// Accepts a number, a numeric string, null or "" and returns a number or null.
// Anything else is rejected rather than coerced: "12abc" must not silently
// become 12, because that would put a wrong price in the shop.
function optionalNumber(value, label) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new AdminValidationError(`${label} must be a number.`);
  }
  return n;
}

/**
 * Turns a request body into a clean, validated row.
 *
 * Only keys in WRITABLE are copied, so the request cannot set `id` or
 * `created_at`. Missing keys are left out entirely rather than set to null,
 * because a partial form (admin only fixing stock) must not wipe the price.
 */
function buildProductPatch(input, { isNew }) {
  requireConfigured();
  const body = input || {};
  const patch = {};

  for (const [key, column] of Object.entries(WRITABLE)) {
    if (!Object.prototype.hasOwnProperty.call(body, key)) continue;

    if (key === "active" || key === "five_g") {
      // Checkboxes send "true"/"on" or nothing at all. Anything not clearly
      // true is false, so a missing checkbox means the box is unticked.
      patch[column] = body[key] === true || body[key] === "true" || body[key] === "on";
    } else if (key === "stock") {
      const stock = Number(body[key]);
      if (!Number.isFinite(stock) || stock < 0) {
        throw new AdminValidationError("Stock cannot be less than zero.");
      }
      patch[column] = Math.floor(stock);
    } else if (key === "price_ngn") {
      const price = optionalNumber(body[key], "Price");
      if (price === null || price <= 0) {
        throw new AdminValidationError("Price must be greater than zero.");
      }
      patch[column] = price;
    } else if (key === "name" || key === "brand") {
      const text = String(body[key] ?? "").trim();
      if (isNew && !text) {
        throw new AdminValidationError(
          key === "name" ? "A product needs a name." : "A product needs a brand."
        );
      }
      if (text) patch[column] = text;
    } else {
      const value = body[key];
      patch[column] = value === "" ? null : value;
    }
  }

  if (Object.keys(patch).length === 0) {
    throw new AdminValidationError("Nothing to save.");
  }

  // Checked AFTER the loop, not inside it. The loop only visits keys the request
  // actually sent, so a body with no `name` key at all would skip the check and
  // sail through to a database error ("null value in column name"). A form can
  // easily send no name key when the field is left empty.
  if (isNew) {
    if (!patch.name) {
      throw new AdminValidationError("A product needs a name.");
    }
    if (!patch.brand) {
      throw new AdminValidationError("A product needs a brand.");
    }
  }
  return patch;
}

// Feature 26: which model features are still missing, so the admin can see WHY a
// new phone will be ranked poorly. Returned with the product, never guessed at.
function missingModelFeatures(row) {
  return MODEL_FEATURES.filter((feature) => {
    const value = row[feature];
    return value === null || value === undefined || value === "";
  });
}
// Builds the product id for a NEW product.
//
// WHY THIS IS NOT AUTOMATIC: `products.id` is the primary key AND it is the same
// id the model returns in a recommendation (D36). If the shop invented a new id
// for a product, the model could never recommend it, and if the two ever
// disagreed the shopper could not buy what the model suggested. So the id is
// derived from brand + model, exactly like model/src/build_phones_csv.py does,
// with a numeric suffix as a second guard against collisions.
function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\+/g, "plus") // "A200+" must not collide with "A200"
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function nextAvailableId(brand, model) {
  const base = `${slugify(brand)}-${slugify(model)}`.replace(/-+/g, "-");
  let candidate = base || "product";
  let suffix = 2;

  // The suffix loop matters: "Galaxy S26" and "Galaxy S26+" are different phones
  // in the real catalog and a plain slug collapses them onto one id.
  for (;;) {
    const { data, error } = await supabase()
      .from("products")
      .select("id")
      .eq("id", candidate)
      .maybeSingle();
    if (error) throw new Error(`Could not check the product id: ${error.message}`);
    if (!data) return candidate;
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}

// --- reads -------------------------------------------------------------------

/**
 * Lists products for the admin area.
 *
 * Unlike GET /products this includes INACTIVE products, because hiding a product
 * is exactly what an admin needs to see in order to bring it back. It also
 * reports low stock, since "3 left" is the thing that needs action.
 */
async function listForAdmin() {
  requireConfigured();
  const { data, error } = await supabase()
    .from("products")
    .select("*")
    .order("price_ngn", { ascending: true });
  if (error) throw new Error(`Could not read products: ${error.message}`);

  const rows = data || [];
  const stockOf = (r) => Number(r.stock ?? 0);

  return {
    total: rows.length,
    in_stock: rows.filter((r) => r.active && stockOf(r) > 0).length,
    out_of_stock: rows.filter((r) => !r.active || stockOf(r) <= 0).length,
    low_stock: rows.filter((r) => stockOf(r) > 0 && stockOf(r) <= 5).length,
    products: rows.map((r) => ({
      ...r,
      price_ngn: Number(r.price_ngn),
      stock: stockOf(r),
      missing_model_features: missingModelFeatures(r),
    })),
  };
}

// --- writes ------------------------------------------------------------------

/** Creates a product. Returns the new row, including its generated id. */
async function createProduct(input) {
  const patch = buildProductPatch(input, { isNew: true });

  // Defaults chosen so a half-filled form still produces a sellable, honest row.
  // Stock defaults to 0, NOT 10: a phone that has never been counted must not be
  // offered for sale just because someone typed a name into a form.
  if (patch.stock === undefined) patch.stock = 0;
  if (patch.active === undefined) patch.active = true;
  if (patch.description === undefined) {
    patch.description = buildDescription(patch);
  }

  // The id is derived, never accepted from the request: the model must be able to
  // return this same id for the product to be recommendable and buyable (D36).
  // `name` is stored as "Brand Model" (the seed builds it that way), so the model
  // half is whatever follows the brand. Falls back to the full name when the name
  // does not start with the brand, which only affects the id's readability.
  const modelPart = String(patch.name || "")
    .slice(String(patch.brand || "").length)
    .trim();
  const id = await nextAvailableId(patch.brand, modelPart || patch.name);

  const { data, error } = await supabase()
    .from("products")
    .insert({ ...patch, id })
    .select("*")
    .single();
  if (error) throw new Error(`Could not create the product: ${error.message}`);

  return {
    ...data,
    price_ngn: Number(data.price_ngn),
    stock: Number(data.stock),
    missing_model_features: missingModelFeatures(data),
  };
}

/** Updates an existing product. Only the fields present in the body change. */
async function updateProduct(id, input) {
  requireConfigured();
  const patch = buildProductPatch(input, { isNew: false });

  const { data, error } = await supabase()
    .from("products")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`Could not update the product: ${error.message}`);
  if (!data) {
    throw new AdminValidationError(`No product with id "${id}".`);
  }

  return {
    ...data,
    price_ngn: Number(data.price_ngn),
    stock: Number(data.stock),
    missing_model_features: missingModelFeatures(data),
  };
}

// A generated description, so a product added in a hurry still shows something
// useful. Only built from values the admin actually supplied, so it never invents
// a spec (D24).
function buildDescription(patch) {
  const parts = [];
  if (patch.ram_gb) parts.push(`${patch.ram_gb}GB RAM`);
  if (patch.storage_gb) parts.push(`${patch.storage_gb}GB storage`);
  if (patch.battery_mah) parts.push(`${patch.battery_mah}mAh battery`);
  if (patch.main_camera_mp) parts.push(`${patch.main_camera_mp}MP main camera`);
  return parts.join(", ");
}
module.exports = {
  listForAdmin,
  createProduct,
  updateProduct,
  missingModelFeatures,
  MODEL_FEATURES,
  AdminValidationError,
};
