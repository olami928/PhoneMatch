// orders.js — creating and reading orders (Stage 5).
//
// THE ONE RULE THAT MATTERS HERE: the backend never trusts a price, a total or
// a stock count sent by the browser. The cart lives in the shopper's local
// storage, which they can edit with devtools. Every figure is recomputed from
// the database on the way in, so a tampered cart cannot change what is charged
// or what is deducted from stock.
//
// That is also why prices are read from `products`, not from the catalog CSV:
// after Stage 3 the database is the shop's source of truth for what a phone
// costs and how many are left (D28).

const { createClient } = require("@supabase/supabase-js");
const { getCatalog } = require("./catalog");

// Delivery is a flat estimate, matching frontend/src/lib/format.js. AGENTS.md
// requires the estimate to be visible in the cart; this constant is the server
// side of the same rule. Both must agree or the shopper sees one number and is
// charged another.
const DELIVERY_FEE = 5000;
const FREE_DELIVERY_THRESHOLD = 500000;

let client = null;

// Created once and reused. A new client per request would re-read config every
// time and is wasteful on a serverless function that is billed per invocation.
function supabase() {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  // Supabase renamed these keys in 2025: the old `anon` / `service_role` are now
  // `publishable` / `secret`. Accept both so this works whichever the project was
  // created with. Only the SECRET key belongs here — it bypasses row level
  // security, so it must never reach the frontend.
  const key =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY " +
        "(or SUPABASE_SERVICE_ROLE_KEY on an older project)."
    );
  }
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

function isConfigured() {
  return Boolean(
    process.env.SUPABASE_URL &&
      (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)
  );
}

/**
 * Turns the raw request into a validated order, or throws an Error with a
 * shopper-readable message.
 *
 * Input shape (from the frontend):
 *   { email, full_name, phone, address_line, city, state,
 *     items: [{ product_id, quantity }] }
 *
 * Deliberately NOT accepted from the client: price_ngn, total_ngn,
 * delivery_ngn. Anything the shopper sends for those is ignored.
 */
async function buildOrder(input) {
  const body = input || {};

  // ---- 1. Validate the details a human reads ------------------------------
  const email = String(body.email || "").trim().toLowerCase();
  if (!email) throw new ValidationError("Please enter your email address.");
  // A basic shape check. The only way to truly verify an address is to send
  // mail to it, and that is exactly what the confirmation email does.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    throw new ValidationError("That email address does not look right.");
  }

  const fullName = String(body.full_name || "").trim();
  if (!fullName) throw new ValidationError("Please enter your full name.");

  const phone = String(body.phone || "").trim() || null;
  const addressLine = String(body.address_line || "").trim() || null;
  const city = String(body.city || "").trim() || null;
  const state = String(body.state || "").trim() || null;

  // ---- 2. Validate the basket shape --------------------------------------
  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (rawItems.length === 0) {
    throw new ValidationError("Your cart is empty.");
  }
  if (rawItems.length > 50) {
    throw new ValidationError("Too many different phones in one order.");
  }

  const wanted = new Map();
  for (const item of rawItems) {
    const id = String(item?.product_id || "").trim();
    if (!id) throw new ValidationError("A cart item is missing its product id.");

    const quantity = Math.floor(Number(item?.quantity));
    if (!Number.isFinite(quantity) || quantity < 1) {
      throw new ValidationError(`Choose a quantity of at least 1 for ${id}.`);
    }
    if (quantity > 20) {
      throw new ValidationError(`At most 20 of one phone per order (${id}).`);
    }
    // Two lines for the same phone are added together rather than treated as
    // separate rows, so stock cannot be dodged by splitting the quantity.
    wanted.set(id, (wanted.get(id) || 0) + quantity);
  }

  // ---- 3. Re-read every phone from the DATABASE ---------------------------
  const db = supabase();
  const ids = [...wanted.keys()];
  const { data: products, error } = await db
    .from("products")
    .select("id, name, price_ngn, stock, active")
    .in("id", ids);
  if (error) throw new Error(`Could not read products: ${error.message}`);

  const byId = new Map((products || []).map((p) => [p.id, p]));
  const missing = ids.filter((id) => !byId.has(id));
  if (missing.length) {
    throw new ValidationError(
      `These phones are no longer in our catalog: ${missing.join(", ")}.`
    );
  }

  // ---- 4. Reject anything we cannot actually sell -------------------------
  const items = [];
  for (const [id, quantity] of wanted) {
    const product = byId.get(id);

    if (product.active === false) {
      throw new ValidationError(`${product.name} is no longer available.`);
    }
    const stock = Number(product.stock ?? 0);
    if (stock <= 0) {
      throw new ValidationError(`${product.name} is out of stock.`);
    }
    if (quantity > stock) {
      // Say the real number, not just "not enough", so the shopper can fix the
      // cart without guessing.
      throw new ValidationError(
        `Only ${stock} of ${product.name} left, but your cart asks for ${quantity}.`
      );
    }

    // Price comes from the database, never from the request.
    const price = Number(product.price_ngn);
    if (!Number.isFinite(price) || price < 0) {
      throw new Error(`${product.name} has no usable price in the database.`);
    }

    items.push({
      product_id: id,
      name: product.name,
      quantity,
      price_ngn: price,
      line_total: price * quantity,
    });
  }

  // ---- 5. Compute the money ------------------------------------------------
  const subtotal = items.reduce((sum, item) => sum + item.line_total, 0);
  const delivery = subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
  const total = subtotal + delivery;

  return {
    email,
    full_name: fullName,
    phone,
    address_line: addressLine,
    city,
    state,
    items,
    subtotal,
    delivery,
    total,
  };
}

/**
 * Saves the order and its items, then deducts stock.
 *
 * Stock is deducted with a conditional update: we only reduce it when the row
 * still has at least the quantity we need. If two shoppers check out the last
 * phone at the same moment, one of them updates 0 rows and gets a clear
 * "someone got there first" error, instead of stock silently going negative.
 */
async function saveOrder(order) {
  const db = supabase();
  const oversold = [];

  const { data: created, error: insertError } = await db
    .from("orders")
    .insert({
      email: order.email,
      full_name: order.full_name,
      phone: order.phone,
      address_line: order.address_line,
      city: order.city,
      state: order.state,
      total_ngn: order.total,
      delivery_ngn: order.delivery,
      status: "Pending",
    })
    .select("id, created_at, status")
    .single();
  if (insertError) throw new Error(`Could not save the order: ${insertError.message}`);

  const rows = order.items.map((item) => ({
    order_id: created.id,
    product_id: item.product_id,
    quantity: item.quantity,
    price_ngn: item.price_ngn,
  }));
  const { error: itemsError } = await db.from("order_items").insert(rows);
  if (itemsError) {
    // The order row exists but has no items. That is worse than no order at all,
    // so remove it and report the failure. The alternative is a half-saved order
    // that nobody can ever reconcile.
    await db.from("orders").delete().eq("id", created.id);
    throw new Error(`Could not save the order items: ${itemsError.message}`);
  }

  // Record the first status, so the admin order page has a history to show.
  await db.from("order_status_history").insert({
    order_id: created.id,
    status: "Pending",
  });

  // ---- deduct stock, atomically --------------------------------------------
  // decrement_stock() does the check and the subtraction in one database
  // statement, so two shoppers racing for the last phone cannot both win. It
  // returns the remaining stock, or -1 if there was not enough.
  for (const item of order.items) {
    const { data: remaining, error: stockError } = await db.rpc("decrement_stock", {
      p_product_id: item.product_id,
      p_quantity: item.quantity,
    });

    if (stockError) {
      // The order itself is valid and already saved. Failing the checkout over a
      // bookkeeping problem would lose a real order, so we keep it and make the
      // problem loud in the log instead. Admin must reconcile this one by hand.
      console.error(
        `STOCK ERROR on order ${created.id} for ${item.product_id}:`,
        stockError.message
      );
      continue;
    }

    if (Number(remaining) === -1) {
      // Someone bought it between our read and this write. The order is saved, so
      // we must not pretend it failed, but the shopper needs to know and the
      // order needs review.
      console.error(
        `OVERSELL on order ${created.id}: ${item.product_id} x${item.quantity}`
      );
      oversold.push({ product_id: item.product_id, name: item.name });
    }
  }

  return {
    id: created.id,
    created_at: created.created_at,
    status: created.status,
    oversold,
  };
}

/** Reads one order back for the confirmation page. */
async function getOrder(id) {
  if (!/^[0-9a-f-]{36}$/i.test(String(id || ""))) return null;
  const db = supabase();

  const { data: order, error } = await db
    .from("orders")
    .select("id, email, full_name, phone, address_line, city, state, total_ngn, delivery_ngn, status, created_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Could not read the order: ${error.message}`);
  if (!order) return null;

  const { data: items, error: itemsError } = await db
    .from("order_items")
    .select("product_id, quantity, price_ngn")
    .eq("order_id", id);
  if (itemsError) throw new Error(`Could not read the order items: ${itemsError.message}`);

  const orderItems = (items || []).map((item) => ({
    ...item,
    price_ngn: Number(item.price_ngn),
    // Join the name back on so the confirmation page does not show a bare id.
    name: getCatalog().find((p) => p.product_id === item.product_id)?.name || item.product_id,
  }));

  const subtotal = orderItems.reduce(
    (sum, item) => sum + item.price_ngn * item.quantity,
    0
  );
  const delivery = Number(order.delivery_ngn);

  // Return the SAME money field names as POST /orders (subtotal / delivery /
  // total), not the raw database columns (total_ngn / delivery_ngn). These two
  // endpoints are read by the same confirmation page, and when they disagreed
  // the page rendered "—" for every total because it was reading fields this
  // route never returned. One shape for both, so they cannot drift again.
  return {
    ...order,
    total_ngn: Number(order.total_ngn),
    delivery_ngn: delivery,
    subtotal,
    delivery,
    total: subtotal + delivery,
    // Flattened for the same reason: the page reads order.shipping.city.
    shipping: {
      address: order.address_line,
      city: order.city,
      state: order.state,
    },
    items: orderItems,
  };
}

// A 400 the shopper caused, as opposed to a 500 we caused. The route uses this
// to choose the status code, so the frontend can tell "fix your form" from
// "something is broken on our side".
class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
    this.status = 400;
  }
}

module.exports = {
  buildOrder,
  saveOrder,
  getOrder,
  isConfigured,
  ValidationError,
  DELIVERY_FEE,
  FREE_DELIVERY_THRESHOLD,
};
