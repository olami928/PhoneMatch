// format.js — shared display helpers.
//
// Money is formatted in one place so the product list, the detail page and the
// cart can never disagree about how a price is shown (a mismatch here is a
// classic trust bug in a shop).

export function formatNaira(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return "—";
  // Intl gives the right thousands separators without a manual loop, and it is
  // already available in the browser and in Node, so no extra dependency.
  return `₦${new Intl.NumberFormat("en-NG", {
    maximumFractionDigits: 0,
  }).format(value)}`;
}

// Delivery is a flat estimate until Stage 5 gives us real shipping costs.
// AGENTS.md requires the delivery estimate to be visible IN THE CART, not only
// at the last checkout step, so the constant lives here and both places use it.
export const DELIVERY_FEE = 5000;
export const FREE_DELIVERY_THRESHOLD = 500000;
