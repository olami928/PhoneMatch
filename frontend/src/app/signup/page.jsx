"use client";

// /signup — create an account with a name, email and password.
//
// WHY THIS EXISTS: some people do not want to use Google. They should still be
// able to have an account so they can see their order history. The owner asked
// for this path explicitly.
//
// NO extra API key is needed. Supabase handles signup from the publishable key
// that is already in frontend/.env.local.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import SiteHeader from "../../components/SiteHeader";
import {
  signUpWithEmail,
  isAuthConfigured,
  passwordProblem,
  PASSWORD_RULE,
  SIGNIN_UNAVAILABLE,
} from "../../lib/supabaseClient";

export default function SignUpPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const router = useRouter();

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);

    // Checked here so the person is told straight away rather than after a
    // round trip. Supabase enforces its own minimum regardless, so this is
    // politeness, not the security boundary.
    const problem = passwordProblem(password);
    if (problem) {
      setError(problem);
      return;
    }

    setBusy(true);
    const { error: signUpError, needsConfirmation } = await signUpWithEmail({
      fullName,
      email,
      password,
    });

    if (signUpError) {
      // Supabase's own wording is used because it is specific and actionable
      // ("User already registered"). Unlike sign-in, revealing that an address
      // IS registered is acceptable at signup: the person already knows the
      // address, and hiding it only makes "I forgot I already signed up"
      // unfixable.
      setError(signUpError.message);
      setBusy(false);
      return;
    }

    if (needsConfirmation) {
      // The honest next step is to go and read the email. We do NOT sign them
      // in here: email confirmation is what stops a stranger creating a usable
      // account with someone else's address, so pretending they are signed in
      // before they have proved they own it would be a lie.
      setDone(true);
      return;
    }

    router.push("/");
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex max-w-md flex-col px-4 py-12">
        <h1 className="text-2xl font-semibold text-slate-900">Create an account</h1>

        {done ? (
          <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-5">
            <h2 className="font-semibold text-green-900">Check your email</h2>
            <p className="mt-2 text-sm text-green-800">
              We sent a confirmation link to <strong>{email}</strong>. Open it to
              finish setting up your account.
            </p>
            <p className="mt-3 text-sm text-green-800">
              You can carry on shopping as a guest in the meantime — you do not
              need an account to order.
            </p>
            <Link
              href="/phones"
              className="mt-4 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              Continue shopping
            </Link>
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm text-slate-600">
              An account lets you see your order history. You do not need one to
              order.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
              <div>
                <label
                  htmlFor="full_name"
                  className="block text-sm font-medium text-slate-700"
                >
                  Full name
                </label>
                <input
                  id="full_name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
                />
              </div>

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

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-slate-700"
                >
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={PASSWORD_RULE.minLength}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-describedby="password-help"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
                />
                <p id="password-help" className="mt-1 text-xs text-slate-500">
                  {PASSWORD_RULE.describe}
                </p>
              </div>

              {error && (
                <p
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={busy || !isAuthConfigured()}
                className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? "Creating your account..." : "Create account"}
              </button>
            </form>

            {!isAuthConfigured() && (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                {SIGNIN_UNAVAILABLE}
              </p>
            )}

            <p className="mt-4 text-sm text-slate-600">
              Already have an account?{" "}
              <Link href="/signin" className="font-medium text-slate-900 underline">
                Sign in
              </Link>
            </p>
          </>
        )}
      </main>
    </>
  );
}