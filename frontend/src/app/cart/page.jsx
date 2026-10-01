// /cart — the cart (Stage 2, fake data held in the browser).
//
// Checkout is NOT built yet: that is Stage 5, and it needs the database. This
// page shows the basket, the delivery estimate (which AGENTS.md requires to be
// visible here, not only at the last step), and a disabled button that says
// why, so it never looks like a broken shop.

"use client";

import Link from "next/link";
import SiteHeader from "../../components/SiteHeader";
import { useCart } from "../../components/CartProvider";
import {
  DELIVERY_FEE,
  FREE_DELIVERY_THRESHOLD,
  formatNaira,
} from "../../lib/format";

export default function CartPage() {
  const { items, subtotal, updateQuantity, removeItem, ready } = useCart();

  if (!ready) {
    // Cart lives in local storage, so the first render has nothing yet.
    // Show a placeholder instead of flashing an empty cart.
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-5xl px-4 py-10 text-center text-sm text-zinc-500">
          Loading your cart…
        </main>
      </>
    );
  }

  const delivery = subtotal >= FREE_DELIVERY_THRESHOLD || subtotal === 0 ? 0 : DELIVERY_FEE;
  const total = subtotal + delivery;
  const toFreeDelivery = FREE_DELIVERY_THRESHOLD - subtotal;

  return (
    <>
      <SiteHeader />

      <main className="mx-auto max-w-5xl px-4 py-6">
        <h1 className="text-2xl font-semibold text-zinc-900">Your cart</h1>

        {items.length === 0 ? (
          <div className="mt-6 rounded-lg border border-zinc-200 p-8 text-center">
            <p className="font-medium text-zinc-900">Your cart is empty</p>
            <p className="mt-1 text-sm text-zinc-600">
              Browse the phones, or let our model pick one for you.
            </p>
            <div className="mt-4 flex justify-center gap-3">
              <Link
                href="/phones"
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
              >
                Shop phones
              </Link>
              <Link
                href="/"
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium"
              >
                Find my phone
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            <div className="md:col-span-2">
              <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200">
                {items.map((item) => (
                  <li key={item.product_id} className="flex items-center gap-3 p-3">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-xl font-semibold text-zinc-300">
                      {item.name?.charAt(0)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/phones/${item.product_id}`}
                        className="block truncate font-medium text-zinc-900 hover:underline"
                      >
                        {item.name}
                      </Link>
                      <p className="text-sm text-zinc-500">
                        {formatNaira(item.price_ngn)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="sr-only" htmlFor={`qty-${item.product_id}`}>
                        Quantity for {item.name}
                      </label>
                      <input
                        id={`qty-${item.product_id}`}
                        type="number"
                        min={1}
                        max={item.stock ?? undefined}
                        value={item.quantity}
                        onChange={(e) =>
                          updateQuantity(item.product_id, Number(e.target.value))
                        }
                        className="w-16 rounded border border-zinc-300 px-2 py-1 text-sm"
                      />
                      <button
                        onClick={() => removeItem(item.product_id)}
                        className="text-sm text-zinc-500 underline hover:text-red-600"
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="h-fit rounded-lg border border-zinc-200 p-4">
              <h2 className="font-medium text-zinc-900">Summary</h2>

              <dl className="mt-3 space-y-2 text-sm">
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

              {/* Visible here on purpose: AGENTS.md says show delivery in the
                  cart, not only at the final step. */}
              {delivery > 0 && (
                <p className="mt-3 rounded bg-zinc-50 p-2 text-xs text-zinc-600">
                  Spend {formatNaira(toFreeDelivery)} more for free delivery.
                </p>
              )}

              <button
                disabled
                title="Checkout arrives at Stage 5, when the database is connected."
                className="mt-4 w-full cursor-not-allowed rounded-lg bg-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-500"
              >
                Checkout (coming at Stage 5)
              </button>

              <Link
                href="/phones"
                className="mt-2 block text-center text-sm text-zinc-600 underline hover:text-zinc-900"
              >
                Continue shopping
              </Link>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
