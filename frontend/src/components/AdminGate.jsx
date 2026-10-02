"use client";

// AdminGate — the "you cannot be here" states for the admin area.
//
// It exists so /admin, /admin/products and /admin/orders all refuse the same
// way, in the same words, for the same reasons. Three copies of this check is
// how one of them ends up quietly not checking.
//
// IMPORTANT: this is CONVENIENCE, NOT SECURITY. Every admin route is gated by
// requireAdmin in the backend, so editing this file to let anyone in gains an
// attacker nothing. It is here to say something clear rather than to protect
// anything.

import Link from "next/link";
import { useAuth } from "./AuthProvider";

export default function AdminGate({ children }) {
  const { user, loading, isAdmin } = useAuth();

  // While we do not know who this is yet, saying "no access" would be a lie.
  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <p className="text-sm text-slate-600">Checking your access...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
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

  // Signed in, but the profiles table says this account is not an admin.
  if (!isAdmin) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
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

  return children;
}
