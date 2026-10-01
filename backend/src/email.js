// email.js — Mailgun sending for the shop (Stage 9).
//
// WHY THIS FILE IS DELIBERATELY DEFENSIVE
// A failed order email is a customer who never hears their order arrived. So
// nothing here throws into the order path, and every send returns a result the
// caller can store. A silent catch that says "sent" when it wasn't is the one
// failure mode worth engineering against.
//
// SANDBOX REALITY: the configured domain is a Mailgun *sandbox* domain. Those
// can only send to VERIFIED recipients. Any other address is refused by
// Mailgun. Rather than discover that at a customer's checkout, we check the
// allow-list first and report the skip with a reason.

const FormData = require("form-data");
const Mailgun = require("mailgun.js");

function config() {
  return {
    apiKey: process.env.MAILGUN_API_KEY,
    domain: process.env.MAILGUN_DOMAIN,
    apiBase: process.env.MAILGUN_API_BASE || "https://api.mailgun.net",
    from: process.env.MAILGUN_FROM,
    adminEmail: process.env.ADMIN_EMAIL,
    allowed: (process.env.MAILGUN_ALLOWED_RECIPIENTS || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  };
}

function isConfigured() {
  const c = config();
  return Boolean(c.apiKey && c.domain && c.from);
}

// A sandbox domain only delivers to verified addresses, so we can know in
// advance whether this will work. Cheap check, saves a pointless API round trip.
function canSendTo(email) {
  const c = config();
  if (!email) return { ok: false, reason: "no_recipient" };
  if (c.allowed.length === 0) return { ok: true };
  const addr = String(email).trim().toLowerCase();
  if (c.allowed.includes(addr)) return { ok: true };
  return {
    ok: false,
    reason: "recipient_not_verified_in_sandbox",
  };
}

let client = null;
function getClient() {
  if (client) return client;
  const c = config();
  const mailgun = new Mailgun(FormData);
  client = mailgun.client({
    username: "api",
    key: c.apiKey,
    url: c.apiBase,
  });
  return client;
}

// Low-level send. NEVER throws: returns { sent, id, reason, detail }.
// Callers must check `sent` before telling a customer anything.
async function send({ to, subject, text, html, replyTo }) {
  const c = config();
  if (!isConfigured()) {
    return { sent: false, reason: "mailgun_not_configured" };
  }
  const allowed = canSendTo(to);
  if (!allowed.ok) {
    return { sent: false, reason: allowed.reason, to };
  }
  try {
    const payload = { from: c.from, to: [to], subject, text };
    if (html) payload.html = html;
    if (replyTo) payload["h:Reply-To"] = replyTo;
    const data = await getClient().messages.create(c.domain, payload);
    return { sent: true, id: data && data.id, to };
  } catch (err) {
    // Log the real reason for us, but return a shape the caller can store.
    console.error("mailgun send failed:", err.message);
    return { sent: false, reason: "mailgun_error", detail: err.message, to };
  }
}

function formatNaira(n) {
  const v = Number(n) || 0;
  return "NGN " + v.toLocaleString("en-NG", { maximumFractionDigits: 0 });
}

// --- Templates -------------------------------------------------------------
// Plain text first, HTML second. The text version is not optional: it is what
// lands in the notification if HTML is stripped, and it is what a screen reader
// user gets in some clients.

function orderConfirmationEmail({ order, items }) {
  const lines = (items || [])
    .map(
      (i) =>
        `  ${i.quantity} x ${i.name} — ${formatNaira(i.price_ngn)} each = ${formatNaira(
          i.price_ngn * i.quantity
        )}`
    )
    .join("\n");

  const text = [
    `Hi ${order.full_name},`,
    "",
    "Thanks for your order. We have it and we will be in touch.",
    "",
    `Order: ${order.id}`,
    "",
    "Items:",
    lines,
    "",
    `Subtotal: ${formatNaira(order.total_ngn)}`,
    `Delivery: ${formatNaira(order.delivery_ngn)}`,
    `Total: ${formatNaira(order.total_ngn + order.delivery_ngn)}`,
    "",
    `We will email you again when it ships.`,
  ].join("\n");

  const rows = (items || [])
    .map(
      (i) =>
        `<tr><td style="padding:6px 0">${i.quantity} x ${escapeHtml(i.name)}</td>` +
        `<td style="padding:6px 0;text-align:right">${formatNaira(
          i.price_ngn * i.quantity
        )}</td></tr>`
    )
    .join("");

  const html = `<div style="font-family:system-ui,sans-serif;color:#18181b">
  <p>Hi ${escapeHtml(order.full_name)},</p>
  <p>Thanks for your order. We have it and we will be in touch.</p>
  <p><strong>Order:</strong> ${escapeHtml(order.id)}</p>
  <table style="border-collapse:collapse;margin:12px 0;width:100%">${rows}</table>
  <p>Delivery: ${formatNaira(order.delivery_ngn)}<br/>
     <strong>Total: ${formatNaira(order.total_ngn + order.delivery_ngn)}</strong></p>
  <p>We will email you again when it ships.</p>
</div>`;

  return {
    to: order.email,
    subject: `Your PhoneMatch order ${order.id}`,
    text,
    html,
  };
}

// Feature 23: the shop owner gets told about new orders.
function newOrderAlertEmail({ order, items }) {
  const count = (items || []).reduce((n, i) => n + (i.quantity || 0), 0);
  const text = [
    `New order received.`,
    "",
    `Order: ${order.id}`,
    `Customer: ${order.full_name} <${order.email}>`,
    `Phone: ${order.phone || "not given"}`,
    `Address: ${[order.address_line, order.city, order.state].filter(Boolean).join(", ")}`,
    "",
    `${count} item(s)`,
    `Total: ${formatNaira(order.total_ngn + order.delivery_ngn)}`,
  ].join("\n");

  return {
    to: config().adminEmail,
    subject: `New order ${order.id} — ${formatNaira(order.total_ngn + order.delivery_ngn)}`,
    text,
  };
}

// Feature 22: tell the customer when the order status changes.
function statusUpdateEmail({ order, status }) {
  const text = [
    `Hi ${order.full_name},`,
    "",
    `Your order ${order.id} is now: ${status}`,
    "",
    "Thanks for shopping with PhoneMatch.",
  ].join("\n");
  return {
    to: order.email,
    subject: `Order ${order.id} — ${status}`,
    text,
  };
}

function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

module.exports = {
  isConfigured,
  canSendTo,
  send,
  orderConfirmationEmail,
  newOrderAlertEmail,
  statusUpdateEmail,
};
