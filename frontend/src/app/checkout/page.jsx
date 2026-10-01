"use client";

// /checkout — Stage 5. Turns the cart into a saved order.
//
// GUESTS ARE ALLOWED (D12). There is no sign-in step here, and none is required:
// the only thing we ask for is where to deliver the phone and an email for the
// receipt. Google sign-in is Stage 6 and is optional.
//
// WHAT THE BROWSER SENDS: product ids and quantities only. Prices, totals and
// stock are deliberately NOT sent, because the cart lives in local storage and a
// shopper can edit it. The backend recomputes every figure from the database, so
// a tampered cart changes nothing. See backend/src/orders.js.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import SiteHeader from "../../components/SiteHeader";
import { useCart } from "../../components/CartProvider";
import {
  DELIVERY_FEE,
  FREE_DELIVERY_THRESHOLD,
  formatNaira,
} from "../../lib/format";

const EMPTY = {
  full_name: "",
  email: "",
  phone: "",
  address_line: "",
  city: "",
  state: "",
};

// Nigerian states, so the field is a picker instead of a free-text box. A typo in
// a state name is a failed delivery, and this list keeps it to one tap.
const STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue",
  "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu",
  "FCT - Abuja", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina",
  "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo",
  "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara",
];

export default function CheckoutPage() {
  const { items, subtotal, ready, clearCart } = useCart();
  const router = useRouter();

  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");

  const delivery = subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
  const total = subtotal + delivery;

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    // Clear the message for a field as soon as the shopper edits it, so the
    // error does not sit there contradicting what they just typed.
    setErrors((e) => (e[field] ? { ...e, [field]: undefined } : e));
  }

  // Client-side checks exist to save a round trip and to give instant feedback.
  // They are NOT security: the backend validates everything again regardless.
  function validate() {
    const next = {};
    if (!form.full_name.trim()) next.full_name = "Please enter your full name.";
    if (!form.email.trim()) next.email = "Please enter your email address.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim()))
      next.email = "That email address does not look right.";
    if (!form.phone.trim()) next.phone = "Please enter your phone number.";
    else if (form.phone.replace(/\D/g, "").length < 10)
      next.phone = "That phone number looks too short.";
    if (!form.address_line.trim()) next.address_line = "Please enter your address.";
    if (!form.city.trim()) next.city = "Please enter your city.";
    if (!form.state) next.state = "Please choose your state.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setServerError("");
    if (items.length === 0) {
      setServerError("Your cart is empty.");
      return;
    }
    if (!validate()) return;

    setSubmitting(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/orders`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // Ids and quantities only. No prices, no totals: the server recomputes
          // them, and sending them would only create something to be tampered with.
          body: JSON.stringify({
            ...form,
            items: items.map((item) => ({
              product_id: item.product_id,
              quantity: item.quantity,
            })),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setServerError(data.error || "We could not save your order. Please try again.");
        setSubmitting(false);
        return;
      }

      // The order is saved, so the basket has done its job. Clear it, then show
      // the confirmation. Clearing before the redirect stops a refresh on the
      // confirmation page from re-submitting the same order.
      clearCart();
      router.push(`/order/${data.order_id}`);
    } catch {
      setServerError(
        "We could not reach the shop. Check your connection and try again."
      );
      setSubmitting(false);
    }
  }

  if (!ready) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-5xl px-4 py-10 text-center text-sm text-zinc-500">
          Loading…
        </main>
      </>
    );
  }

  if (items.length === 0) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-5xl px-4 py-10">
          <div className="rounded-lg border border-zinc-200 p-8 text-center">
            <p className="font-medium text-zinc-900">There is nothing to check out</p>
            <p className="mt-1 text-sm text-zinc-600">
              Add a phone to your cart first.
            </p>
            <Link
              href="/phones"
              className="mt-4 inline-block rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
            >
              Shop phones
            </Link>
          </div>
        </main>
      </>
    );
  }

  const field =
    "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none";
  const label = "mb-1 block text-sm font-medium text-zinc-700";

  return (
    <>
      <SiteHeader />

      <main className="mx-auto max-w-5xl px-4 py-6">
        <h1 className="text-2xl font-semibold text-zinc-900">Checkout</h1>
        <p className="mt-1 text-sm text-zinc-600">
          No account needed. We only need where to deliver and an email for your
          receipt.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-6 grid gap-6 md:grid-cols-3"
          noValidate
        >
          <div className="md:col-span-2">
            <div className="rounded-lg border border-zinc-200 p-4">
              <h2 className="font-medium text-zinc-900">Delivery details</h2>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className={label} htmlFor="full_name">Full name</label>
                  <input
                    id="full_name"
                    className={field}
                    autoComplete="name"
                    value={form.full_name}
                    onChange={(e) => set("full_name", e.target.value)}
                    aria-invalid={Boolean(errors.full_name)}
                  />
                  {errors.full_name && (
                    <p className="mt-1 text-xs text-red-600">{errors.full_name}</p>
                  )}
                </div>

                <div>
                  <label className={label} htmlFor="email">Email</label>
                  <input
                    id="email"
                    type="email"
                    className={field}
                    autoComplete="email"
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    aria-invalid={Boolean(errors.email)}
                  />
                  {errors.email && (
                    <p className="mt-1 text-xs text-red-600">{errors.email}</p>
                  )}
                </div>

                <div>
                  <label className={label} htmlFor="phone">Phone number</label>
                  <input
                    id="phone"
                    type="tel"
                    className={field}
                    autoComplete="tel"
                    placeholder="080 1234 5678"
                    value={form.phone}
                    onChange={(e) => set("phone", e.target.value)}
                    aria-invalid={Boolean(errors.phone)}
                  />
                  {errors.phone && (
                    <p className="mt-1 text-xs text-red-600">{errors.phone}</p>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <label className={label} htmlFor="address_line">Address</label>
                  <input
                    id="address_line"
                    className={field}
                    autoComplete="street-address"
                    value={form.address_line}
                    onChange={(e) => set("address_line", e.target.value)}
                    aria-invalid={Boolean(errors.address_line)}
                  />
                  {errors.address_line && (
                    <p className="mt-1 text-xs text-red-600">{errors.address_line}</p>
                  )}
                </div>

                <div>
                  <label className={label} htmlFor="city">City</label>
                  <input
                    id="city"
                    className={field}
                    autoComplete="address-level2"
                    value={form.city}
                    onChange={(e) => set("city", e.target.value)}
                    aria-invalid={Boolean(errors.city)}
                  />
                  {errors.city && (
                    <p className="mt-1 text-xs text-red-600">{errors.city}</p>
                  )}
                </div>

                <div>
                  <label className={label} htmlFor="state">State</label>
                  <select
                    id="state"
                    className={field}
                    value={form.state}
                    onChange={(e) => set("state", e.target.value)}
                    aria-invalid={Boolean(errors.state)}
                  >
                    <option value="">Choose a state</option>
                    {STATES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  {errors.state && (
                    <p className="mt-1 text-xs text-red-600">{errors.state}</p>
                  )}
                </div>
              </div>
            </div>

            {serverError && (
              <p
                role="alert"
                className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              >
                {serverError}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-4 w-full rounded-lg bg-zinc-900 px-4 py-3 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-400 sm:w-auto sm:px-8"
            >
              {submitting ? "Placing your order…" : "Place order"}
            </button>

            <p className="mt-3 text-xs text-zinc-500">
              Payment is simulated in this version (D16). No card is charged.
            </p>
          </div>

          <div className="h-fit rounded-lg border border-zinc-200 p-4">
            <h2 className="font-medium text-zinc-900">Order summary</h2>

            <ul className="mt-3 space-y-2 text-sm">
              {items.map((item) => (
                <li key={item.product_id} className="flex justify-between gap-2">
                  <span className="min-w-0 truncate text-zinc-700">
                    {item.quantity} × {item.name}
                  </span>
                  <span className="shrink-0 font-medium">
                    {formatNaira(item.price_ngn * item.quantity)}
                  </span>
                </li>
              ))}
            </ul>

            <dl className="mt-4 space-y-2 border-t border-zinc-200 pt-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-zinc-600">Subtotal</dt>
                <dd className="font-medium">{formatNaira(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-600">Delivery</dt>
                <dd className="font-medium">
                  {delivery === 0 ? "Free" : formatNaira(delivery)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-zinc-200 pt-2 text-base">
                <dt className="font-medium text-zinc-900">Total</dt>
                <dd className="font-semibold text-zinc-900">{formatNaira(total)}</dd>
              </div>
            </dl>

            {/* The figures above are for display only. The server recomputes all
                of them, so a stale local price can never change what is charged. */}
            <p className="mt-3 text-xs text-zinc-500">
              We confirm the price and stock when your order is saved.
            </p>
          </div>
        </form>
      </main>
    </>
  );
}
