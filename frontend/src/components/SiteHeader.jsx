"use client";

// SiteHeader is the top bar on every shop page.
//
// Two rules from AGENTS.md section 10 shape this bar:
//  - the model is the front door, so "Find my phone" is the first item, not a
//    link hidden in the footer (D18, D20)
//  - the model entry point must be reachable from every page, so it stays in
//    the header rather than only on the home page
//
// "Find my phone" is not wired to the questionnaire yet: that is Stage 10, and
// it needs the model service (M7). Until then it points at the filter, so the
// button is never a dead end.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "./CartProvider";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/phones?min_price=0&max_price=300000", label: "Shop" },
];

export default function SiteHeader() {
  const { count } = useCart();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
        <Link href="/" className="text-lg font-semibold tracking-tight text-zinc-900">
          PhoneMatch
        </Link>

        <nav className="flex items-center gap-1 text-sm">
          {LINKS.map((link) => {
            const active = pathname === link.href.split("?")[0];
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "rounded px-2 py-1.5 font-medium text-zinc-900"
                    : "rounded px-2 py-1.5 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                }
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {/* The main call to action. Sits in the header on every page. */}
          <Link
            href="/phones"
            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700"
          >
            Find my phone
          </Link>

          <Link
            href="/cart"
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
          >
            Cart
            {/* aria-live so the count is announced when it changes. */}
            <span aria-live="polite" className="ml-1 tabular-nums text-zinc-500">
              ({count})
            </span>
          </Link>
        </div>
      </div>
    </header>
  );
}
