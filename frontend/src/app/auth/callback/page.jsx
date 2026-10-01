"use client";

// /auth/callback — where Google sends the shopper back after signing in.
//
// Supabase reads the tokens out of the URL fragment itself, so there is nothing
// for this page to parse and no client secret is ever exposed. The page's only
// job is to WAIT for the session to be established, then send the shopper on.
//
// It must not send anyone onward based on a `next` parameter read from the URL
// without checking it: an unchecked value is an open redirect that could bounce
// a shopper (and their Google identity) to another site. That is why this page
// always goes to the home page.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser, isAuthConfigured } from "../../../lib/supabaseClient";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Finishing sign-in...");

  useEffect(() => {
    const supabase = supabaseBrowser();
    if (!supabase) {
      setMessage("Sign-in is not available.");
      return;
    }

    let cancelled = false;

    // getSession() is what makes Supabase consume the tokens in the URL. If it
    // is never called the shopper would sit on this page forever, signed in at
    // Google but not here. Polling is a safety net for the rare case where the
    // listener fires before the session is ready.
    let attempts = 0;
    const check = async () => {
      attempts += 1;
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;

      if (data?.session) {
        router.replace("/");
        return;
      }
      // Give up after a few seconds and explain, rather than spinning forever.
      if (attempts >= 10) {
        setMessage(
          "Sign-in took too long. Please close this page and try again."
        );
        return;
      }
      setTimeout(check, 300);
    };

    check();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <h1 className="text-xl font-semibold text-slate-900">{message}</h1>
      <p className="mt-2 text-sm text-slate-600">
        {isAuthConfigured()
          ? "This only takes a moment."
          : "This site does not have sign-in configured yet."}
      </p>
    </main>
  );
}