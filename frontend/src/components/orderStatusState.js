// orderStatusState.js — the rules for the admin orders screens (Stage 8).
//
// Kept out of the components so they can be read and tested without wading
// through JSX, matching productFormState.js from Stage 7.
//
// THE ONE RULE THAT MATTERS HERE: cancelling is not just a label.
//
// Setting an order to Cancelled puts the phones back on the shelf, because they
// were never sent. Moving an order OUT of Cancelled takes them off the shelf
// again. Getting the second direction wrong is not cosmetic: the same phone
// becomes sellable twice and two shoppers can both pay for one unit. The
// backend enforces this for real (it calls increment_stock and decrement_stock
// separately), but the UI must warn the human, because this is the one status
// change that moves real stock.

/** Tones for the status pill, kept here so every screen colours them alike. */
export const STATUS_TONE = {
  Pending: "bg-amber-100 text-amber-800",
  Paid: "bg-emerald-100 text-emerald-800",
  Packed: "bg-amber-100 text-amber-800",
  Shipped: "bg-violet-100 text-violet-800",
  Delivered: "bg-green-100 text-green-800",
  Cancelled: "bg-slate-200 text-slate-700",
};

/**
 * What a status change will actually DO, so the admin is told before clicking.
 * Returns a short sentence, or null when nothing is worth warning about.
 */
export function describeStatusChange(from, to) {
  if (!from || !to || from === to) return null;
  if (to === "Cancelled") {
    return "This puts the phones back into stock. Anyone can buy them again.";
  }
  if (from === "Cancelled") {
    return "This takes the phones back out of stock. If they were already sold, stock will refuse to go below zero.";
  }
  return null;
}

/**
 * Whether the change needs a second confirming click.
 *
 * Only the two stock-moving directions. A Pending -> Shipped change is routine,
 * and asking every time would train the admin to click through the warning
 * without reading it — the same reasoning Stage 7 uses for the stock field.
 */
export function needsStatusConfirmation(from, to) {
  return describeStatusChange(from, to) !== null;
}

/** A short order reference for display: the first 8 characters of the uuid. */
export function shortRef(id) {
  return String(id || "").slice(0, 8).toUpperCase();
}

/** Formats a timestamp without pulling in a date library. */
export function formatWhen(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}