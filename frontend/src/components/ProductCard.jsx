"use client";

// ProductCard shows one phone in the product list.
//
// Reused on the product list, the home page and (in a different layout) the
// results page later, so the price and stock wording stay identical everywhere.

import Link from "next/link";
import { useState } from "react";
import { useCart } from "./CartProvider";
import { formatNaira } from "../lib/format";

// No phone photos yet; admin uploads images at Stage 7. Rather than show a
// broken image, this renders the brand initial so the grid stays tidy.
function PhonePlaceholder({ brand, name }) {
  return (
    <div
      aria-hidden="true"
      className="flex aspect-4/3 w-full items-center justify-center rounded-lg bg-zinc-100 text-4xl font-semibold text-zinc-300"
    >
      {brand ? brand.charAt(0).toUpperCase() : "?"}
      <span className="sr-only">{name}</span>
    </div>
  );
}

export default function ProductCard({ product }) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  const outOfStock = !product.active || product.stock <= 0;

  function handleAdd() {
    addItem(product, 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  return (
    <article className="group flex flex-col rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-sm shadow-slate-200/50 transition hover:-translate-y-1 hover:shadow-lg hover:shadow-blue-100/60">
      <Link href={`/phones/${product.product_id}`} className="block overflow-hidden rounded-xl">
        {product.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image}
            alt={product.name}
            loading="lazy"
            className="aspect-4/3 w-full rounded-xl object-cover transition duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <PhonePlaceholder brand={product.brand} name={product.name} />
        )}
      </Link>

      <div className="mt-3 flex flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/phones/${product.product_id}`}
            className="text-base font-semibold text-slate-900 hover:text-blue-700"
          >
            {product.name}
          </Link>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600">
            {product.brand}
          </span>
        </div>

        <p className="mt-1 text-xs text-slate-500">
          {product.ram_gb}GB RAM · {product.storage_gb}GB · {product.battery_mah}mAh
        </p>

        <p className="mt-3 text-lg font-semibold text-slate-900">
          {formatNaira(product.price_ngn)}
        </p>

        <div className="mt-auto pt-3">
          {outOfStock ? (
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-center text-sm font-medium text-slate-500">
              Out of stock
            </p>
          ) : (
            <button
              onClick={handleAdd}
              className="w-full rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              {added ? "Added to cart" : "Add to cart"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
