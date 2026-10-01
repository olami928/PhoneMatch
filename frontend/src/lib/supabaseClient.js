// Talking to Supabase Auth from the browser (Stage 6).
//
// ONLY the publishable (anon) key is used here. That key is designed to be
// public — it ships in the browser bundle — and the row level security policies
// in backend/src/db/row_level_security.sql decide what it can actually do. The
// secret key bypasses those policies and must never be imported by frontend
// code; `scripts/check-for-secrets.sh` fails the build if one appears here.
//
// The access token is attached to backend requests by apiFetch() below, because
// the backend needs to know WHO is calling (AGENTS.md section 11). The frontend
// never decides on its own what a person is allowed to see — it only proves who
// they are.

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Built lazily rather than at module load. If the env vars are missing, the rest
// of the site (browsing, cart, the questionnaire) must still work — sign-in
// should be the only thing that breaks, not every page.
let client = null;

export function isAuthConfigured() {
  return Boolean(url && publishableKey);
}

export function supabaseBrowser() {
  if (!isAuthConfigured()) return null;
  if (!client) {
    client = createClient(url, publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Supabase puts `sb-<ref>-auth-token` in local storage, not a cookie, so
        // there is nothing for the server to read. That is why every protected
        // screen must fetch its data through the backend rather than directly.
        detectSessionInUrl: true,
      },
    });
  }
  return client;
}

/**
 * Sends a shopper to Google to sign in.
 *
 * The browser never sees an OAuth client secret; Supabase handles the token
 * exchange. `redirectTo` must be one of the URLs allowed in Supabase ->
 * Authentication -> URL Configuration, otherwise Google will refuse the redirect.
 * Returns an error object rather than throwing, so the sign-in button can show a
 * readable message instead of a blank screen.
 */
export async function signInWithGoogle() {
  const supabase = supabaseBrowser();
  if (!supabase) {
    return {
      error: {
        message:
          "Sign-in is not set up on this site yet. You can still order as a guest.",
      },
    };
  }

  const redirectTo =
    typeof window !== "undefined"
      ? `${window.location.origin}/auth/callback`
      : undefined;

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      // Must be one of the URLs allowed in Supabase -> Authentication -> URL
      // Configuration, otherwise Google refuses the redirect.
      redirectTo,
      // Only the two things the shop actually shows. Asking for more scopes than
      // we use would make the consent screen scarier for no benefit.
      scopes: "email profile",
    },
  });

  if (error) return { error };
  return { error: null };
}

export async function signOut() {
  const supabase = supabaseBrowser();
  if (!supabase) return;
  await supabase.auth.signOut();
}