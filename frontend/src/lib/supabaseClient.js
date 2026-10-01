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

// One message for every "not configured" path, so the wording cannot drift
// between the four functions below. The site stays fully usable without
// accounts, because guest checkout is allowed (D12).
const SIGNIN_UNAVAILABLE =
  "Accounts are not set up on this site yet. You can still order as a guest.";

export { SIGNIN_UNAVAILABLE };

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
        message: SIGNIN_UNAVAILABLE,
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

// --- Email and password ------------------------------------------------------
//
// WHY THIS EXISTS ALONGSIDE GOOGLE: some people do not want to sign in with a
// Google account. They should still be able to create an account here, so they
// can see their order history. NO extra API key is needed for any of this: the
// publishable key above is all Supabase requires, and it is already in
// frontend/.env.local.
//
// Supabase's own email service is rate limited to roughly 2 emails per hour on
// a free project, which is far too few for real signups and password resets.
// Until SMTP is configured (see AGENTS.md Session 13), confirmation and reset
// emails may be slow or dropped. That is a dashboard setting, not code.

// The one place a password rule is written. Signup enforces it before sending,
// so a person is told immediately instead of after a round trip and a generic
// error. Supabase enforces its own minimum server-side regardless.
export const PASSWORD_RULE = {
  minLength: 8,
  describe:
    "At least 8 characters. A short sentence or a few unrelated words works well.",
};

// Returns a message the person can act on, or null when the password is fine.
export function passwordProblem(password) {
  if (typeof password !== "string" || password.length < PASSWORD_RULE.minLength) {
    return `Your password needs to be at least ${PASSWORD_RULE.minLength} characters.`;
  }
  return null;
}

/**
 * Creates an account with a name, email and password.
 *
 * Returns `{ error, needsConfirmation }`. `needsConfirmation` is true because
 * this project has email confirmation ON, which is deliberate: it is what stops
 * a stranger creating a usable account with somebody else's address (measured
 * in Session 13). We do NOT auto-sign-in, because pretending they are signed in
 * before they have proved they own the address would be a lie the UI then has to
 * walk back.
 */
export async function signUpWithEmail({ fullName, email, password }) {
  const supabase = supabaseBrowser();
  if (!supabase) return { error: { message: SIGNIN_UNAVAILABLE }, needsConfirmation: false };

  const trimmedName = String(fullName || "").trim();
  if (!trimmedName) {
    return { error: { message: "Please enter your name." }, needsConfirmation: false };
  }

  const passwordError = passwordProblem(password);
  if (passwordError) {
    return { error: { message: passwordError }, needsConfirmation: false };
  }

  const { data, error } = await supabase.auth.signUp({
    email: String(email || "").trim(),
    password,
    // Stored in user metadata and copied into profiles.full_name on first
    // sign-in by the backend. It is a display name, never used for sign-in.
    options: { data: { full_name: trimmedName } },
  });

  if (error) return { error, needsConfirmation: false };
  return { error: null, needsConfirmation: !data.session };
}

/** Signs in with email and password. */
export async function signInWithEmail({ email, password }) {
  const supabase = supabaseBrowser();
  if (!supabase) return { error: { message: SIGNIN_UNAVAILABLE } };

  const { error } = await supabase.auth.signInWithPassword({
    email: String(email || "").trim(),
    password,
  });
  return { error };
}

/**
 * Sends a password reset link.
 *
 * The SAME message is returned whether or not the address exists, on purpose.
 * Saying "no account with that email" would let anyone test which addresses are
 * registered, which is a way of harvesting customer emails.
 */
export async function sendPasswordReset(email) {
  const supabase = supabaseBrowser();
  if (!supabase) return { error: { message: SIGNIN_UNAVAILABLE } };

  const { error } = await supabase.auth.resetPasswordForEmail(
    String(email || "").trim(),
    {
      redirectTo:
        typeof window !== "undefined"
          ? `${window.location.origin}/reset-password`
          : undefined,
    }
  );
  return { error };
}

/** Sets a new password once the recovery link has been opened. */
export async function updatePassword(password) {
  const supabase = supabaseBrowser();
  if (!supabase) return { error: { message: SIGNIN_UNAVAILABLE } };

  const passwordError = passwordProblem(password);
  if (passwordError) return { error: { message: passwordError } };

  const { error } = await supabase.auth.updateUser({ password });
  return { error };
}