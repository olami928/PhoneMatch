"use client";

// SiteHeader is the top bar on every shop page.
//
// Two rules from AGENTS.md section 10 shape this bar:
//  - the model is the front door, so "Find my phone" is the first item, not a
//    link hidden in the footer (D18, D20)
//  - the model entry point must be reachable from every page, so it stays in
//    the header rather than only on the home page
//
// This button now goes to the real questionnaire at /find. The questionnaire
// itself is live; only the ranking at the end is waiting on the model service.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "./CartProvider";
import { useAuth } from "./AuthProvider";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/phones?min_price=0&max_price=300000", label: "Shop" },
];

// Turns a long email into something that fits in a header bar without losing
// the part that identifies it. "dimeji.ife@gmail.com" -> "dimeji.ife@gmail.com"
// (short enough to show), "someone.with.a.very.long.address@example.com" ->
// "someone...@example.com".
function shortLabel(email) {
  const value = String(email || "");
  if (value.length <= 22) return value;
  const [name, domain] = value.split("@");
  if (!domain) return value;
  return `${name.slice(0, 10)}...@${domain}`;
}

export default function SiteHeader() {
  const { count } = useCart();
  const pathname = usePathname();

  let auth = { user: null, loading: false, isAdmin: false, signOut: () => { } };
  try {
    auth = useAuth();
  } catch {
    // This is a safe fallback for local/dev cases where the provider has not
    // fully mounted yet or is temporarily missing.
  }

  const { user, loading, isAdmin, signOut } = auth;

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2 rounded-full bg-slate-900 px-2.5 py-1.5 text-sm font-semibold tracking-tight text-white shadow-sm">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15 text-[10px]">PM</span>
          PhoneMatch
        </Link>

        <nav className="hidden items-center gap-1 text-sm md:flex">
          {LINKS.map((link) => {
            const active = pathname === link.href.split("?")[0];
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "rounded-full bg-blue-50 px-3 py-1.5 font-medium text-blue-700"
                    : "rounded-full px-3 py-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {/* Sign-in state. Nothing renders while `loading`, so the bar does not
              flash "Sign in" at someone who is already signed in. */}
          {!loading && user && (
            <div className="hidden items-center gap-2 sm:flex">
              {/* The admin link is shown only to admins. This is CONVENIENCE,
                  not security: the admin routes reject non-admins server-side,
                  so editing this page out gains an attacker nothing. */}
              {isAdmin && (
                <Link
                  href="/admin"
                  className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Admin
                </Link>
              )}
              <span className="max-w-[180px] truncate text-xs text-slate-500">
                {shortLabel(user.email)}
              </span>
              <button
                onClick={signOut}
                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Sign out
              </button>
            </div>
          )}

          {!loading && !user && (
            <Link
              href="/signin"
              className="hidden rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 sm:inline-block"
            >
              Sign in
            </Link>
          )}

          <Link
            href="/find"
            className="rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-blue-200 transition hover:translate-y-[-1px] hover:shadow-md"
          >
            Find my phone
          </Link>

          <Link
            href="/cart"
            className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            Cart
            <span aria-live="polite" className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-blue-100 px-1.5 py-0.5 text-[11px] font-semibold text-blue-700 tabular-nums">
              {count}
            </span>
          </Link>
        </div>
      </div>
    </header>
  );
}
