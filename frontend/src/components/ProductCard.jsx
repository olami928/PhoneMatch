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
    <article className="flex flex-col rounded-xl border border-zinc-200 bg-white p-3">
      <Link href={`/phones/${product.product_id}`} className="block">
        {product.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image}
            alt={product.name}
            loading="lazy"
            className="aspect-4/3 w-full rounded-lg object-cover"
          />
        ) : (
          <PhonePlaceholder brand={product.brand} name={product.name} />
        )}
      </Link>

      <div className="mt-3 flex flex-1 flex-col">
        <Link
          href={`/phones/${product.product_id}`}
          className="font-medium text-zinc-900 hover:underline"
        >
          {product.name}
        </Link>

        <p className="mt-0.5 text-xs text-zinc-500">
          {product.ram_gb}GB RAM · {product.storage_gb}GB ·{" "}
          {product.battery_mah}mAh
        </p>

        <p className="mt-2 text-lg font-semibold text-zinc-900">
          {formatNaira(product.price_ngn)}
        </p>

        <div className="mt-auto pt-3">
          {outOfStock ? (
            // Feature 20: zero stock hides the Add button and says so plainly.
            <p className="rounded-lg border border-zinc-200 px-3 py-2 text-center text-sm text-zinc-500">
              Out of stock
            </p>
          ) : (
            <button
              onClick={handleAdd}
              className="w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700"
            >
              {added ? "Added to cart" : "Add to cart"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
