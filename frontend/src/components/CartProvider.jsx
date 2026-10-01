"use client";

// CartProvider holds the cart for the whole app.
//
// WHY LOCAL STORAGE: Stage 2 is explicitly "cart with fake data" and there is no
// database until Stage 3, so the cart has to live in the browser. Using storage
// (not a React variable) means a page refresh does not silently empty the basket,
// which is the single most annoying thing a shop can do to a shopper.
//
// Guests can check out (D12), so there is no user account to attach this to yet.
// When Supabase arrives at Stage 5 this provider is the one place to change.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "phonematch.cart.v1";

const CartContext = createContext(null);

// Read on the client only. During the server render there is no storage, so we
// start empty and fill in after mount; otherwise the server and client markup
// would disagree and Next.js would complain.
function readStoredCart() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Keep only entries that still make sense: a positive quantity and an id.
    return parsed
      .filter((item) => item && typeof item.product_id === "string" && item.quantity > 0)
      .map((item) => ({
        product_id: item.product_id,
        name: String(item.name || ""),
        price_ngn: Number(item.price_ngn) || 0,
        quantity: Math.floor(Number(item.quantity)) || 1,
        stock: Number.isFinite(Number(item.stock)) ? Number(item.stock) : null,
      }));
  } catch {
    // Corrupt storage must not break the shop. Start clean instead.
    return [];
  }
}

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setItems(readStoredCart());
    setReady(true);
  }, []);

  // Save on every change, but never before the first read, or we would overwrite
  // a stored cart with the empty initial state.
  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Storage can be full or blocked. The cart still works for this visit.
    }
  }, [items, ready]);

  const addItem = useCallback((product, quantity = 1) => {
    setItems((current) => {
      const existing = current.find((item) => item.product_id === product.product_id);
      if (existing) {
        // Never let the cart exceed what is actually in stock.
        const ceiling = Number.isFinite(product.stock) ? product.stock : Infinity;
        const nextQuantity = Math.min(existing.quantity + quantity, ceiling);
        return current.map((item) =>
          item.product_id === product.product_id
            ? { ...item, quantity: Math.max(1, nextQuantity), stock: product.stock }
            : item
        );
      }
      const ceiling = Number.isFinite(product.stock) ? product.stock : Infinity;
      return [
        ...current,
        {
          product_id: product.product_id,
          name: product.name,
          price_ngn: product.price_ngn,
          quantity: Math.max(1, Math.min(quantity, ceiling)),
          stock: product.stock,
        },
      ];
    });
  }, []);

  const updateQuantity = useCallback((productId, quantity) => {
    setItems((current) =>
      current
        .map((item) =>
          item.product_id === productId
            ? {
                ...item,
                quantity: Math.min(
                  Math.max(0, Math.floor(quantity) || 0),
                  Number.isFinite(item.stock) ? item.stock : Infinity
                ),
              }
            : item
        )
        // Quantity 0 means "remove", which is how most shops behave.
        .filter((item) => item.quantity > 0)
    );
  }, []);

  const removeItem = useCallback((productId) => {
    setItems((current) => current.filter((item) => item.product_id !== productId));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const value = useMemo(() => {
    const count = items.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = items.reduce(
      (sum, item) => sum + item.price_ngn * item.quantity,
      0
    );
    return {
      items,
      count,
      subtotal,
      ready,
      addItem,
      updateQuantity,
      removeItem,
      clearCart,
    };
  }, [items, ready, addItem, updateQuantity, removeItem, clearCart]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used inside <CartProvider>.");
  }
  return context;
}
