"use client";

// /signin — Google sign-in (Stage 6).
//
// Sign-in is OPTIONAL for shoppers (D12): guest checkout works exactly as it did
// before, and this page says so rather than making an account feel mandatory.
// Signing in adds order history and, for the owner, the admin area.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import SiteHeader from "../../components/SiteHeader";
import { signInWithGoogle, isAuthConfigured } from "../../lib/supabaseClient";
import { useAuth } from "../../components/AuthProvider";

export default function SignInPage() {
  const { user, loading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const router = useRouter();

  async function handleSignIn() {
    setBusy(true);
    setError(null);
    const { error: signInError } = await signInWithGoogle();
    if (signInError) {
      // Shown here instead of a blank screen. Google sign-in fails for ordinary
      // reasons (popup blocked, provider not enabled yet), and the shopper can
      // still order as a guest either way.
      setError(signInError.message || "Sign-in did not work. Please try again.");
      setBusy(false);
    }
    // On success the browser navigates to Google, so `setBusy(false)` is
    // deliberately not called: leaving the button disabled stops a double click
    // opening two Google popups.
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex max-w-md flex-col px-4 py-12">
        <h1 className="text-2xl font-semibold text-slate-900">Sign in</h1>

        {/* Someone who is already signed in has no business on this page. */}
        {!loading && user ? (
          <div className="mt-6 rounded-xl border border-slate-200 p-5">
            <p className="text-sm text-slate-600">
              You are already signed in as {user.email}.
            </p>
            <button
              onClick={() => router.push("/")}
              className="mt-4 w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              Continue shopping
            </button>
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm text-slate-600">
              Signing in lets you see your order history. You do not need an
              account to order.
            </p>

            <button
              onClick={handleSignIn}
              disabled={busy || !isAuthConfigured()}
              className="mt-6 flex w-full items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {/* Google's brand guidelines ask for the official "G" mark. Drawn
                  simply here; replace with the official SVG before launch. */}
              <span aria-hidden="true" className="text-base font-semibold text-blue-600">
                G
              </span>
              {busy ? "Opening Google..." : "Continue with Google"}
            </button>

            {!isAuthConfigured() && (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Sign-in is not set up on this site yet. You can still order as a
                guest.
              </p>
            )}

            {error && (
              <p
                role="alert"
                className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              >
                {error}
              </p>
            )}

            {/* D12: guest checkout is a first-class path, shown next to the
                Google button exactly as the PRD wireframe requires. */}
            <div className="mt-6 border-t border-slate-200 pt-4">
              <Link
                href="/phones"
                className="text-sm font-medium text-slate-600 underline hover:text-slate-900"
              >
                Continue as guest
              </Link>
              <p className="mt-1 text-xs text-slate-500">
                You can check out without an account.
              </p>
            </div>
          </>
        )}
      </main>
    </>
  );
}