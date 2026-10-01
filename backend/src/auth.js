// auth.js — who is calling, and are they allowed (Stage 6).
//
// THE ONE RULE: the backend NEVER trusts what the browser says about a user. A
// request may claim `role: "admin"` in its body; that claim is ignored
// completely. Identity comes from the Supabase access token, the token is
// verified with Supabase itself, and the ROLE is then read from our own
// `profiles` table in the database. Hiding the admin button in the UI is a
// convenience, not security — every admin route calls `requireAdmin`.
//
// WHY VERIFY THE TOKEN AT ALL INSTEAD OF JUST DECODING IT: a JWT is only
// trustworthy once its signature has been checked against the provider's key.
// `getUser(token)` does that over the network, so a forged token carrying
// `{"role":"admin"}` is rejected. This costs one round trip per request, which
// is the correct trade for an admin area.

const { createClient } = require("@supabase/supabase-js");
const { supabase, isConfigured } = require("./supabaseClient");

let tokenClient = null;

// A SEPARATE client, built with the PUBLIC publishable key, verifies tokens.
// Using the secret key here would work, but it would make the auth path depend
// on a privileged key: if it were ever missing, tokens would fail to verify and
// every signed-in user would appear signed out. The public key is the
// documented approach and cannot be misconfigured into privilege escalation.
function verifier() {
  if (tokenClient) return tokenClient;
  const url = process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Cannot verify sign-in tokens: set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY."
    );
  }
  tokenClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return tokenClient;
}

// Pulls the bearer token out of the Authorization header.
//
// Accepts `Bearer <token>` only. A bare token with no scheme is rejected rather
// than guessed at, so there is exactly one accepted format to reason about.
function readToken(req) {
  const header = req.get("authorization") || req.get("Authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

/**
 * Resolves the caller to `{ user, profile }`, or null when not signed in.
 *
 * A bad or expired token returns null (treated as signed out) instead of
 * throwing: an expired token is an ordinary thing that happens, and it should
 * quietly become a guest rather than a 500 on every page.
 */
async function currentUser(req) {
  const token = readToken(req);
  if (!token) return null;

  let user = null;
  try {
    const { data, error } = await verifier().auth.getUser(token);
    if (error || !data || !data.user) return null;
    user = data.user;
  } catch (err) {
    // A network failure while verifying must not be read as "signed in".
    console.error("token verification failed:", err.message);
    return null;
  }

  // The role is read from OUR table, never from the token's claims. Even a
  // genuinely signed-in user cannot grant themselves admin by editing a claim,
  // because the claim is not consulted.
  const profile = await ensureProfile(user);

  return { user, profile, token };
}

/**
 * Finds the caller's profile, creating it on first sign-in.
 *
 * The row is created with role 'customer' and can never be set by the browser.
 * AGENTS.md notes the first admin is promoted by hand in Supabase, which is
 * deliberate: admin must not be self-assignable at signup.
 *
 * Uses upsert on the primary key with `ignoreDuplicates`, so two requests
 * arriving at once (a page firing several calls right after login) cannot fail:
 * the loser of the race simply reads the row the winner inserted.
 */
async function ensureProfile(user) {
  if (!isConfigured()) return null;

  const { data, error } = await supabase()
    .from("profiles")
    .upsert(
      {
        id: user.id,
        email: user.email || null,
        full_name:
          (user.user_metadata &&
            (user.user_metadata.full_name || user.user_metadata.name)) ||
          null,
        // 'customer' is written explicitly rather than relying on the column
        // default, so the intent is visible and cannot be changed by a future
        // edit to the schema.
        role: "customer",
      },
      { onConflict: "id", ignoreDuplicates: true }
    )
    .select("id, email, full_name, role")
    .maybeSingle();

  if (error) {
    // A profile we cannot read is not a reason to fail the request. The user is
    // still authenticated; they simply have no profile row yet.
    console.error("could not read the profile:", error.message);
    return null;
  }
  return data || null;
}
/**
 * Gate for admin routes. Sends the right status and stops the request.
 *
 * 401 = not signed in (the browser should send the person to sign in).
 * 403 = signed in but not an admin (hiding the admin area is not enough, so the
 *       route itself refuses).
 */
function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "Please sign in to use the admin area." });
  }
  if (!req.profile || req.profile.role !== "admin") {
    return res.status(403).json({ error: "This area is for shop administrators only." });
  }
  return next();
}

/**
 * Attaches `req.user` and `req.profile` when a valid token is present, and lets
 * the request continue either way. Most routes are public; the ones needing an
 * identity use `requireUser` or `requireAdmin`.
 *
 * Runs on every request so a shopper only sends their token once — the token is
 * checked here, and the gates below just read what was resolved.
 */
async function attachUser(req, _res, next) {
  try {
    const found = await currentUser(req);
    req.user = found ? found.user : null;
    req.profile = found ? found.profile : null;
  } catch (err) {
    // Never let an auth problem become a crash on a public route.
    console.error("attachUser failed:", err.message);
    req.user = null;
    req.profile = null;
  }
  next();
}

/** Gate for routes that need a signed-in shopper (e.g. order history). */
function requireUser(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "Please sign in to see this." });
  }
  return next();
}

module.exports = {
  attachUser,
  currentUser,
  requireUser,
  requireAdmin,
  readToken,
};