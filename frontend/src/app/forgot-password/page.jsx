"use client";

// /forgot-password — ask for a reset link.
//
// The message shown is IDENTICAL whether or not the address has an account.
// Saying "we have no account with that email" would turn this form into a tool
// for discovering which addresses are registered here, which is how customer
// lists get harvested. Not saying it also means an attacker learns nothing from
// a wrong guess.
//
// Only useful for EMAIL accounts. A Google sign-in user has no password in this
// system; Google owns it and has its own recovery.

import { useState } from "react";
import Link from "next/link";
import SiteHeader from "../../components/SiteHeader";
import { sendPasswordReset, isAuthConfigured } from "../../lib/supabaseClient";

const SAME_MESSAGE =
  "If that email has an account with us, a reset link is on its way. Check your inbox and your spam folder.";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    await sendPasswordReset(email);
    // The result is ignored on purpose: whether the address exists is not
    // something this page is allowed to reveal.
    setSent(true);
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex max-w-md flex-col px-4 py-12">
        <h1 className="text-2xl font-semibold text-slate-900">Reset your password</h1>

        {sent ? (
          <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-5">
            <p className="text-sm text-green-800">{SAME_MESSAGE}</p>
            <Link
              href="/signin"
              className="mt-4 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm text-slate-600">
              Enter your email and we will send you a link to choose a new
              password.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-slate-700"
                >
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={busy || !isAuthConfigured()}
                className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? "Sending..." : "Send reset link"}
              </button>
            </form>

            {/* Sign-in with Google, so somebody who arrived here by mistake is
                not stuck. */}
            <p className="mt-6 border-t border-slate-200 pt-4 text-sm text-slate-600">
              Signed in with Google? Google has its own password recovery, so you
              do not need a password here.{" "}
              <Link href="/signin" className="font-medium text-slate-900 underline">
                Back to sign in
              </Link>
            </p>
          </>
        )}
      </main>
    </>
  );
}