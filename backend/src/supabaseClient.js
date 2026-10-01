// supabaseClient.js — the one place the shop talks to the database.
//
// WHY THIS IS ITS OWN FILE: two modules need the database (products and orders),
// and each one creating its own client meant two copies of the key logic that
// could drift. The key names are checked in ONE place, so a renamed Supabase
// variable can never be handled correctly for orders and forgotten for products.
//
// SECURITY: only the SECRET key is used here. It bypasses row level security, so
// it must stay on the server. The frontend gets the publishable key from
// NEXT_PUBLIC_* and must never import this file.

const { createClient } = require("@supabase/supabase-js");

let client = null;

// Supabase renamed these keys in 2025: the old `anon` / `service_role` are now
// `publishable` / `secret`. Accept both spellings so this works whichever the
// project was created with.
function secretKey() {
  return process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
}

// True when the shop has everything it needs to read the database.
function isConfigured() {
  return Boolean(process.env.SUPABASE_URL && secretKey());
}

// Returns the shared client. Throws with an actionable message rather than a
// bare TypeError, because "database not configured" is the single most likely
// cause of a broken local run.
function supabase() {
  if (client) return client;
  if (!isConfigured()) {
    throw new Error(
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY " +
        "(or SUPABASE_SERVICE_ROLE_KEY on an older project) in backend/.env."
    );
  }
  client = createClient(process.env.SUPABASE_URL, secretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

module.exports = { supabase, isConfigured };