"use client";

// AddToCartButton is the one button that needs to be a client component: it
// writes to the cart in the browser. Everything around it stays server-rendered.

import { useState } from "react";
import { useCart } from "./CartProvider";

export default function AddToCartButton({ product, outOfStock = false }) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  if (outOfStock) {
    // Feature 20: out of stock hides the button and states the reason.
    return (
      <p className="rounded-lg border border-zinc-200 px-4 py-2.5 text-center text-sm font-medium text-zinc-500">
        Out of stock
      </p>
    );
  }

  function handleClick() {
    addItem(product, 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <button
      onClick={handleClick}
      className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 md:w-auto"
    >
      {added ? "Added to cart" : "Add to cart"}
    </button>
  );
}
