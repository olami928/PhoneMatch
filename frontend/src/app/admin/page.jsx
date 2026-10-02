"use client";

// /admin — the admin landing page.
//
// Small on purpose: it links to the areas that exist and says plainly which are
// not built yet, so the owner can tell "not started" from "broken". AGENTS.md
// warns that a section which looks unfinished but is actually failing is worse
// than one that is honestly absent.

import Link from "next/link";
// /admin/page.jsx sits one directory below app/, so components are two levels up.
import { useAuth } from "../../components/AuthProvider";

export default function AdminHomePage() {
  const { user, loading, isAdmin } = useAuth();

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-sm text-slate-600">Checking your access...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-xl font-semibold text-slate-900">Admin</h1>
        <p className="mt-2 text-sm text-slate-600">Please sign in to continue.</p>
        <Link
          href="/signin"
          className="mt-4 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          Sign in
        </Link>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-xl font-semibold text-slate-900">Admin</h1>
        <p className="mt-2 text-sm text-slate-600">
          This area is for shop administrators. Your account does not have admin
          access.
        </p>
        <Link
          href="/"
          className="mt-4 inline-block text-sm font-medium text-slate-900 underline"
        >
          Back to the shop
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-slate-900">Admin</h1>
      <p className="mt-1 text-sm text-slate-600">
        Signed in as {user.email}
      </p>

      <ul className="mt-6 space-y-3">
        <li className="rounded-xl border border-slate-200 p-4">
          <Link href="/admin/products" className="font-medium text-slate-900 underline">
            Products
          </Link>
          <p className="mt-1 text-sm text-slate-600">
            Add a phone, change its price, and set its stock.
          </p>
        </li>
        <li className="rounded-xl border border-slate-200 p-4">
          <Link href="/admin/orders" className="font-medium text-slate-900 underline">
            Orders
          </Link>
          <p className="mt-1 text-sm text-slate-600">
            See every order, and change its status to update the customer.
          </p>
        </li>
        <li className="rounded-xl border border-dashed border-slate-300 p-4 text-slate-500">
          <span className="font-medium">Model feedback</span>
          <p className="mt-1 text-sm">Not built yet. Coming after orders.</p>
        </li>
      </ul>

      <Link href="/" className="mt-8 inline-block text-sm text-slate-600 underline">
        Back to the shop
      </Link>
    </main>
  );
}