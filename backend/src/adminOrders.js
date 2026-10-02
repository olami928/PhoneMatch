// adminOrders.js — the admin side: orders and status changes (Stage 8).
//
// THE THREE RULES THAT MATTER HERE:
//
//   1. STATUS IS A CONTROLLED LIST, not free text. The database has a check
//      constraint on it, but relying on that means a typo returns a raw Postgres
//      error. It is validated here first so the admin sees a readable message.
//
//   2. CANCELLING RESTOCKES THE PHONES. This is the part that is easy to forget
//      and expensive to get wrong: checkout already deducted the stock, so a
//      cancelled order that does not put it back means the shop is selling a
//      phone that is sitting on a shelf, and the model stops recommending it
//      because stock hit 0 and never recovered.
//
//   3. ONLY A REAL CHANGE DOES ANYTHING. Re-saving "Pending" on a Pending order
//      must not send a second email or restock anything, so the early return
//      below happens before any write. This is also what stops a double-click
//      from inflating stock.

const { supabase, isConfigured } = require("./supabaseClient");
const email = require("./email");

// The order statuses from AGENTS.md section 6. This list is the single source of
// truth for the admin UI, the validation and the email text. It is served to
// the frontend from the API instead of being hardcoded there, which is how a
// status would otherwise be added to the database but not to the admin screen.
const STATUSES = [
  "Pending",
  "Paid",
  "Packed",
  "Shipped",
  "Delivered",
  "Cancelled",
];

class OrderValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "OrderValidationError";
    this.status = 400;
  }
}

function requireConfigured() {
  if (!isConfigured()) {
    throw new Error("Supabase is not configured, so orders cannot be read or changed.");
  }
}

/**
 * Turns an upstream error into something an admin can act on.
 *
 * This exists because Cloudflare sits in front of Supabase. When a query looks
 * like an attack it answers with a full HTML page instead of JSON, and that page
 * was being concatenated straight into an error message. The result was an API
 * response containing several kilobytes of Cloudflare markup, rendered to the
 * admin as a wall of tags.
 *
 * A JSON-ish message is passed through. Anything containing markup is replaced
 * with a fixed, honest sentence, because the underlying cause is genuinely not
 * knowable from an HTML block page and guessing would be worse than admitting it.
 */
function safeUpstreamError(message) {
  const text = String(message || "");
  if (!/[<>&]|\.html\b/i.test(text)) {
    return text.slice(0, 300);
  }
  return "the request was blocked by our network provider (Cloudflare). Try a shorter, plainer search term.";
}

/** A full uuid, used to decide between an exact id match and a text search. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The columns an order list needs. Explicit rather than `select("*")`. */
const LIST_COLUMNS =
  "id, email, full_name, phone, city, state, total_ngn, delivery_ngn, status, created_at";

/**
 * Lists orders for the admin list, newest first.
 *
 * @param {object} opts
 * @param {string} [opts.status]  filter to one status
 * @param {string} [opts.search]  match against name, email or id
 * @param {number} [opts.limit]   default 50, capped at 200
 */
async function listOrders({ status, search, limit } = {}) {
  requireConfigured();
  const db = supabase();

  let query = db
    .from("orders")
    .select(LIST_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(Math.min(Number(limit) || 50, 200));

  if (status) {
    if (!STATUSES.includes(status)) {
      throw new OrderValidationError(
        `"${status}" is not an order status. Use one of: ${STATUSES.join(", ")}.`
      );
    }
    query = query.eq("status", status);
  }

  const term = String(search || "").trim();
  // A term that is pure hex is treated as an order reference, never as a name.
  //
  // PostgREST cannot prefix-match a uuid column at all: `ilike` fails with
  // "operator does not exist: uuid ~~* unknown", `like` with `uuid ~~ unknown`,
  // and both `sw` and a `::text` cast are rejected with "failed to parse logic
  // tree". So a PARTIAL id cannot be filtered in SQL by any means. Rather than
  // let it silently match nothing, the SQL text filter is skipped for these terms
  // and the id prefix is matched in JS over the fetched page below.
  //
  // The page is capped at 200 orders, so this cannot return an unbounded list.
  const isIdTerm = Boolean(term) && /^[0-9a-f-]+$/i.test(term) && /[0-9a-f]/i.test(term);

  if (term && !isIdTerm) {
    // A LIKE filter. Supabase's .or() takes a raw filter string, so the term has
    // to be neutralised here: an unescaped comma, paren or quote would change the
    // meaning of the whole filter, not just fail.
    //
    // This is an admin convenience, never a security boundary, but it must not
    // be able to break the page either. The character class covers PostgREST
    // filter punctuation AND the SQL-ish punctuation that makes Cloudflare (in
    // front of Supabase) treat a harmless search string as an attack and return
    // an HTML block page. That block page used to be echoed straight into the
    // error message, so an admin typing an apostrophe saw a wall of markup.
    const safe = term
      .replace(/[,()*\\%'"`;<>=!|{}$\-\[\]]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120);
    if (safe) {
      // The id is NOT searched with ilike. `id` is a uuid column and Postgres has
      // no `uuid ~~* unknown` operator, so `id.ilike.*` fails with "operator does
      // not exist" and takes the WHOLE query down, including the name and email
      // search. That made every search on this page fail. Casting inside .or() is
      // rejected by PostgREST ("failed to parse logic tree").
      //
      // Everything goes into ONE .or() call on purpose. Chaining a second .or()
      // for the id would AND the two filters together and match nothing, because
      // no single row both has the name AND is that exact id.
      const clauses = [`full_name.ilike.%${safe}%`, `email.ilike.%${safe}%`];

      // An exact uuid is a common thing to paste: an order reference from an
      // email. `.eq()` is the correct operator for a uuid and needs no escaping.
      if (UUID_RE.test(term)) {
        clauses.push(`id.eq.${term.toLowerCase()}`);
      }
      query = query.or(clauses.join(","));
    }
  }

  const { data, error } = await query;
  if (error) throw new Error(`Could not load the orders: ${safeUpstreamError(error.message)}`);
  if (!data) return [];

  // A PARTIAL id such as "3a4aa" is also worth pasting, and it cannot be done in
  // SQL for the reason above. The SQL text filter was skipped for this term, so
  // the rows are matched here instead. This only ever narrows what the admin can
  // see, and the page is already capped.
  if (isIdTerm) {
    const needle = term.replace(/-/g, "").toLowerCase();
    return data.filter((o) =>
      String(o.id).replace(/-/g, "").startsWith(needle)
    );
  }
  return data;
}

/** Counts per status, for the filter tabs. */
async function statusCounts() {
  requireConfigured();
  const db = supabase();
  const { data, error } = await db.from("orders").select("status");
  if (error) throw new Error(`Could not count the orders: ${error.message}`);

  // Every status appears in the result, including the ones with no orders, so
  // the admin sees "0 Shipped" rather than a tab that silently is not there.
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  for (const row of data || []) {
    if (row.status in counts) counts[row.status] += 1;
  }
  return counts;
}

/** One order with its items and full status history. */
async function getOrderDetail(id) {
  requireConfigured();
  if (!/^[0-9a-f-]{36}$/i.test(String(id || ""))) return null;
  const db = supabase();

  const { data: order, error } = await db
    .from("orders")
    .select(
      "id, user_id, email, full_name, phone, address_line, city, state, total_ngn, delivery_ngn, status, created_at, updated_at"
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Could not read the order: ${error.message}`);
  if (!order) return null;

  const { data: items, error: itemsError } = await db
    .from("order_items")
    .select("product_id, quantity, price_ngn")
    .eq("order_id", id);
  if (itemsError) throw new Error(`Could not read the order items: ${itemsError.message}`);

  // Join the phone names from the DATABASE, not the catalog CSV. If admin
  // renamed a phone (Stage 7) the order page must show the current name, and
  // the CSV is a build-time snapshot that would show the old one.
  const ids = [...new Set((items || []).map((i) => i.product_id))];
  const names = new Map();
  if (ids.length) {
    const { data: named } = await db.from("products").select("id, name").in("id", ids);
    for (const p of named || []) names.set(p.id, p.name);
  }

  const { data: history, error: historyError } = await db
    .from("order_status_history")
    .select("id, status, changed_by, changed_at")
    .eq("order_id", id)
    .order("changed_at", { ascending: true });
  if (historyError) {
    // The order itself loaded fine, so a history problem must not hide it.
    console.error("Could not read the order history:", historyError.message);
  }

  return {
    order,
    items: (items || []).map((i) => ({
      ...i,
      // Fall back to the id when the product row is gone, so the line is still
      // readable rather than showing "undefined".
      name: names.get(i.product_id) || i.product_id,
    })),
    history: history || [],
  };
}


/**
 * Changes an order's status, records the change, and emails the customer.
 *
 * @param {string} orderId
 * @param {string} nextStatus  must be one of STATUSES
 * @param {string} adminUserId  the verified admin, from the token (never the body)
 */
async function setOrderStatus(orderId, nextStatus, adminUserId) {
  requireConfigured();

  if (!/^[0-9a-f-]{36}$/i.test(String(orderId || ""))) {
    throw new OrderValidationError("That is not a valid order reference.");
  }
  const status = String(nextStatus || "").trim();
  if (!STATUSES.includes(status)) {
    throw new OrderValidationError(
      `"${nextStatus}" is not an order status. Use one of: ${STATUSES.join(", ")}.`
    );
  }

  const db = supabase();
  const detail = await getOrderDetail(orderId);
  if (!detail) throw new OrderValidationError("No order was found with that reference.");
  const { order, items } = detail;

  // RULE 3: a no-op change writes nothing, sends nothing and restocks nothing.
  // This is what makes a double-click safe.
  if (order.status === status) {
    return { order, items, changed: false, restocked: [], email: null };
  }

  const wasCancelled = order.status === "Cancelled";
  const nowCancelled = status === "Cancelled";

  const { data: updated, error: updateError } = await db
    .from("orders")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", orderId)
    .select(LIST_COLUMNS)
    .single();
  if (updateError) throw new Error(`Could not update the order: ${updateError.message}`);

  // History is written after the status change, and a failure here is logged
  // rather than thrown: the order IS changed, and failing the request would
  // leave the admin thinking it did not happen and pressing the button again.
  const { error: historyError } = await db.from("order_status_history").insert({
    order_id: orderId,
    status,
    changed_by: adminUserId || null,
  });
  if (historyError) {
    console.error(`Could not record the status history for ${orderId}:`, historyError.message);
  }

  // ---- restock on cancel (RULE 2) -------------------------------------------
  // Two directions, both handled:
  //   -> Cancelled  : the phones were never sent, so put them back.
  //   Cancelled -> x: stock was already returned, so take it out again, or the
  //                 same phone would be sellable twice.
  // Any other change leaves stock alone, because nothing left or arrived.
  let restocked = [];
  if (nowCancelled && !wasCancelled) {
    restocked = await moveStock(orderId, items, +1);
  } else if (wasCancelled && !nowCancelled) {
    restocked = await moveStock(orderId, items, -1);
  }

  // ---- tell the customer (feature 22) --------------------------------------
  //
  // An email failure NEVER rolls back a real status change, for the same reason
  // as in orders.js: losing a real order update because Mailgun was briefly
  // down is far worse than a late email. The outcome is returned so the route
  // can log it, which is how the "silent success" trap in Session 11 is avoided.
  let emailOutcome = { sent: false, reason: "not_attempted" };
  try {
    if (!email.isConfigured()) {
      emailOutcome = { sent: false, reason: "email_not_configured" };
    } else {
      const allowed = email.canSendTo(order.email);
      if (!allowed.ok) {
        emailOutcome = { sent: false, reason: allowed.reason };
      } else {
        const result = await email.send(email.statusUpdateEmail({ order, status }));
        emailOutcome = { sent: true, id: result && result.id };
      }
    }
  } catch (err) {
    emailOutcome = { sent: false, reason: err.message };
    console.error(`Status email failed for order ${orderId}:`, err.message);
  }

  return { order: updated, items, changed: true, restocked, email: emailOutcome };
}


/**
 * Moves every line of an order's stock: +1 returns it to the shelf, -1 takes it
 * back off.
 *
 * The two directions call DIFFERENT database functions, and that is deliberate.
 * The first version of this passed a negative quantity to increment_stock, and
 * the function correctly rejected it (it guards `p_quantity < 1`), so
 * un-cancelling an order silently left the stock too high: the same phone was
 * sellable twice. Taking stock off has to go through decrement_stock, which
 * also refuses when there is not enough — the behaviour we want.
 *
 * Each line is its own call because both functions take a single product. A
 * failure on one line is logged and the rest continue: a partial fix the admin
 * can see beats an all-or-nothing failure that silently loses stock.
 */
async function moveStock(orderId, items, direction) {
  const db = supabase();
  const returning = direction > 0;
  const done = [];

  for (const item of items || []) {
    const { data, error } = returning
      ? await db.rpc("increment_stock", {
          p_product_id: item.product_id,
          p_quantity: item.quantity,
        })
      : await db.rpc("decrement_stock", {
          p_product_id: item.product_id,
          p_quantity: item.quantity,
        });

    if (error) {
      console.error(
        `Stock move failed on order ${orderId} for ${item.product_id}:`,
        error.message
      );
      continue;
    }
    // -1 is the sentinel both functions return for "refused": a missing product
    // for increment_stock, or not enough stock for decrement_stock. Either way
    // the line did not move, so it is reported instead of counted as done.
    if (Number(data) < 0) {
      console.error(
        `Stock move REFUSED on order ${orderId} for ${item.product_id} ` +
          `(returned ${data})${returning ? "" : " — not enough stock to take back"}`
      );
      continue;
    }
    done.push({
      product_id: item.product_id,
      quantity: item.quantity,
      stock: Number(data),
      direction: returning ? "returned" : "removed",
    });
  }
  return done;
}

module.exports = {
  STATUSES,
  listOrders,
  statusCounts,
  getOrderDetail,
  setOrderStatus,
  OrderValidationError,
};

