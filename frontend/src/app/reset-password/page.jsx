"use client";

// /reset-password — where the reset link lands, to set a new password.
//
// SECURITY: this page is only useful when opened from a real recovery link.
// Supabase puts a short-lived token in the URL fragment and exchanges it for a
// session, so a page reached without that token has nobody to change the
// password of. The page therefore checks for a session and says so plainly rather
// than showing a form that would fail on submit.
//
// It never reads a "next" parameter or sends anyone onward: an unchecked
// redirect target is an open-redirect waiting to happen.

import { useEffect, useState } from "react";
import Link from "next/link";
import SiteHeader from "../../components/SiteHeader";
import { supabaseBrowser, updatePassword, passwordProblem, PASSWORD_RULE } from "../../lib/supabaseClient";

export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const supabase = supabaseBrowser();
    if (!supabase) {
      setReady(true);
      return;
    }

    let cancelled = false;

    // Only the TOKEN decides whether we have a session, never the session
    // object itself. `onAuthStateChange` re-emits on every render-adjacent
    // update with a NEW session object, so comparing object identity
    // (`if (session)`) calls setState forever and React kills the page with
    // "Too many re-renders". The build caught this; it is not obvious by
    // reading. Token is a string, so comparing it is stable.
    const tokenOf = (session) => session?.access_token ?? null;

    // getSession() is what makes Supabase consume the token from the URL
    // fragment. Without this call the recovery link would land here with
    // nothing to act on.
    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      setHasSession(Boolean(tokenOf(data?.session)));
      setReady(true);
    };

    check();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === "PASSWORD_RECOVERY" || tokenOf(session)) {
        setHasSession(true);
      }
      setReady(true);
    });

    return () => {
      cancelled = true;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);

    const problem = passwordProblem(password);
    if (problem) {
      setError(problem);
      return;
    }
    // Checked here so a typo is caught before a round trip, and so the two
    // fields cannot silently disagree.
    if (password !== confirm) {
      setError("Those two passwords do not match.");
      return;
    }

    setBusy(true);
    const { error: updateError } = await updatePassword(password);

    if (updateError) {
      setError(updateError.message);
      setBusy(false);
      return;
    }

    // Success. Without this line the button stays stuck on "Saving..." forever
    // and the shopper has no idea whether their password changed.
    setDone(true);
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex max-w-md flex-col px-4 py-12">
        <h1 className="text-2xl font-semibold text-slate-900">Choose a new password</h1>

        {done ? (
          <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-5">
            <h2 className="font-semibold text-green-900">Password changed</h2>
            <p className="mt-2 text-sm text-green-800">
              You can now sign in with your new password.
            </p>
            <Link
              href="/signin"
              className="mt-4 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              Sign in
            </Link>
          </div>
        ) : !ready ? (
          <p className="mt-4 text-sm text-slate-600">Checking your link...</p>
        ) : !hasSession ? (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5">
            <p className="text-sm text-amber-900">
              This page only works from the link in your reset email. That link
              may have expired, or it may already have been used.
            </p>
            <Link
              href="/forgot-password"
              className="mt-4 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              Send me a new link
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-700"
              >
                New password
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

            <div>
              <label
                htmlFor="confirm"
                className="block text-sm font-medium text-slate-700"
              >
                Type it again
              </label>
              <input
                id="confirm"
                name="confirm"
                type="password"
                autoComplete="new-password"
                required
                minLength={PASSWORD_RULE.minLength}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
              />
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
              disabled={busy}
              className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Saving..." : "Save new password"}
            </button>
          </form>
        )}
      </main>
    </>
  );
}