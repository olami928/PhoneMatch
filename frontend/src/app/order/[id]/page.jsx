// /order/[id] — the order confirmation page.
//
// Checkout redirects here after POST /orders succeeds. This page exists so a
// refresh (or a shared link) cannot silently re-submit the order: the cart is
// already cleared before the redirect, and this page only READS.
//
// It is a server component so the order renders fully on first paint. That
// matters on a phone on a slow connection — the shopper sees their order, not a
// spinner.

import Link from "next/link";
import { formatNaira } from "../../../lib/format";

async function fetchOrder(id) {
  const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
  try {
    const res = await fetch(`${base}/orders/${id}`, { cache: "no-store" });
    if (!res.ok) return { error: res.status === 404 ? "notfound" : "failed" };
    const data = await res.json();
    return { order: data.order };
  } catch {
    // The backend being down must not render as a broken page.
    return { error: "failed" };
  }
}

export default async function OrderConfirmationPage({ params }) {
  const { id } = await params;
  const { order, error } = await fetchOrder(id);

  if (error === "notfound") {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="text-2xl font-semibold text-zinc-900">Order not found</h1>
        <p className="mt-2 text-zinc-600">
          We could not find that order. Check the link in your confirmation email.
        </p>
        <Link href="/" className="mt-6 inline-block text-sm font-medium underline">
          Back to the shop
        </Link>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="text-2xl font-semibold text-zinc-900">
          We could not load your order
        </h1>
        <p className="mt-2 text-zinc-600">
          Your order was placed. Please check your email for the confirmation, or try
          again in a moment.
        </p>
        <Link href="/" className="mt-6 inline-block text-sm font-medium underline">
          Back to the shop
        </Link>
      </main>
    );
  }

  const items = order.items || [];

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <p className="text-sm font-medium text-emerald-700">Order placed</p>
      <h1 className="mt-1 text-2xl font-semibold text-zinc-900">
        Thank you{order.full_name ? `, ${order.full_name}` : ""}.
      </h1>
      <p className="mt-2 text-zinc-600">
        We have emailed a confirmation to{" "}
        <span className="text-zinc-900">{order.email}</span>.
      </p>

      <p className="mt-4 text-xs text-zinc-500">
        Order reference <span className="font-mono">{order.id}</span>
      </p>

      {/*
        Oversold is the one case where the shopper must know something went
        wrong at their end. Silence here means a parcel simply never arrives.
      */}
      {order.oversold && (
        <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900">
            Part of your order went out of stock while you were checking out.
          </p>
          <p className="mt-1 text-sm text-amber-800">
            We have emailed you the details and will refund anything unavailable. You do
            not need to do anything.
          </p>
        </div>
      )}

      <div className="mt-8 rounded-xl border border-zinc-200">
        <h2 className="border-b border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-900">
          What you ordered
        </h2>
        <ul className="divide-y divide-zinc-100">
          {items.map((item) => (
            <li key={item.product_id} className="flex items-baseline justify-between px-4 py-3">
              <span className="text-sm text-zinc-900">
                {item.name}
                <span className="ml-2 text-zinc-500">x{item.quantity}</span>
              </span>
              <span className="text-sm tabular-nums text-zinc-700">
                {formatNaira(item.price_ngn * item.quantity)}
              </span>
            </li>
          ))}
        </ul>

        <dl className="space-y-1 border-t border-zinc-200 px-4 py-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-zinc-600">Subtotal</dt>
            <dd className="tabular-nums text-zinc-900">{formatNaira(order.subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-zinc-600">Delivery</dt>
            <dd className="tabular-nums text-zinc-900">{formatNaira(order.delivery)}</dd>
          </div>
          <div className="flex justify-between border-t border-zinc-100 pt-2 font-medium">
            <dt className="text-zinc-900">Total</dt>
            <dd className="tabular-nums text-zinc-900">{formatNaira(order.total)}</dd>
          </div>
        </dl>
      </div>

      {order.shipping && (
        <div className="mt-6 text-sm text-zinc-600">
          <h2 className="font-medium text-zinc-900">Delivering to</h2>
          <p className="mt-1">
            {order.shipping.city}
            {order.shipping.state ? `, ${order.shipping.state}` : ""}
          </p>
          <p className="text-zinc-500">{order.shipping.address}</p>
        </div>
      )}

      <p className="mt-8 text-sm text-zinc-500">
        Current status: <span className="font-medium text-zinc-700">{order.status}</span>
      </p>

      <div className="mt-6 flex gap-3">
        <Link
          href="/phones"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          Keep shopping
        </Link>
        <Link
          href="/find"
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
        >
          Find my phone
        </Link>
      </div>
    </main>
  );
}
