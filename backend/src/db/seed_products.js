// seed_products.js - load the 63 launch phones into Supabase (Stage 3).
//
// WHY THE CSV IS THE SOURCE: it reads model/data/phones.csv via catalog.js,
// the exact file the model scores. If the shop and the model had separate
// product lists, the model could recommend a phone the shop cannot buy.
// Sharing the file removes that whole class of bug (AGENTS.md section 15).
//
// Run:  node src/db/seed_products.js
// Needs backend/.env with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.

require("dotenv").config();
const { getCatalog } = require("../catalog");

// CommonJS, like the rest of the backend (package.json has no "type": "module").
async function main() {
  const url = process.env.SUPABASE_URL;
  // Supabase renamed these keys. The secret key is the new name for what used to
  // be called service_role; the publishable key is the new name for anon. We
  // accept both spellings so this works on an older project too.
  const serviceKey =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const publishableKey =
    process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !serviceKey) {
    console.error(
      "Missing SUPABASE_URL or the secret key in backend/.env.\n" +
        "Find them in Supabase -> Project Settings -> API.\n" +
        "The service_role key bypasses row level security. Never put it in\n" +
        "frontend code, never commit it, never paste it into chat."
    );
    process.exit(1);
  }

  // Lazy require so the error message above prints before the SDK is needed.
  const { createClient } = require("@supabase/supabase-js");
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  // getCatalog() already parses the CSV correctly (RFC4180, quoted
  // imputed_fields lists), converts numbers and booleans, and builds the
  // description. Reusing it keeps one definition of "a phone" in the codebase.
  const catalog = getCatalog();
  console.log(`read ${catalog.length} phones from phones.csv`);

  const products = catalog.map((p) => ({
    id: p.product_id,              // == the id the model returns
    name: p.name,
    brand: p.brand,
    price_ngn: p.price_ngn,
    description: p.description,
    image: p.image,
    stock: p.stock,
    active: p.active,
    price_tier: p.price_tier,
    condition: p.condition,
    ram_gb: p.ram_gb,
    storage_gb: p.storage_gb,
    battery_mah: p.battery_mah,
    main_camera_mp: p.main_camera_mp,
    selfie_camera_mp: p.selfie_camera_mp,
    display_inches: p.display_inches,
    refresh_rate_hz: p.refresh_rate_hz,
    release_year: p.release_year,
    processor: p.processor,
    five_g: p.five_g,
    // Keep the estimate visible, so a guessed spec is never shown as measured
    // fact (D24) and admin can fix it at Stage 7.
    imputed_any: p.specs_imputed,
    imputed_fields: p.imputed_fields.length ? p.imputed_fields.join(",") : null,
  }));

  // Upsert on id, so re-running updates price and stock rather than failing or
  // duplicating. Safe to re-run whenever the CSV changes.
  const { error } = await supabase
    .from("products")
    .upsert(products, { onConflict: "id" });
  if (error) {
    console.error("seed failed:", error.message);
    process.exit(1);
  }
  console.log(`upserted ${products.length} products`);

  const { count, error: countError } = await supabase
    .from("products")
    .select("*", { count: "exact", head: true });
  if (countError) {
    console.error("count failed:", countError.message);
    process.exit(1);
  }
  console.log(`products now in the database: ${count}`);

  // The catalog-mismatch check from AGENTS.md section 15, run as code instead of
  // trusted: every id the model can return must actually be buyable.
  const { data: rows, error: idError } = await supabase
    .from("products")
    .select("id, active, stock");
  if (idError) {
    console.error("id check failed:", idError.message);
    process.exit(1);
  }
  const inDb = new Map(rows.map((r) => [r.id, r]));
  const missing = products.filter((p) => !inDb.has(p.id)).map((p) => p.id);
  if (missing.length) {
    console.error("FAIL: seeded ids missing from the database:", missing);
    process.exit(1);
  }
  const unsellable = rows.filter((r) => !r.active || r.stock <= 0);
  if (unsellable.length) {
    console.warn(
      `warning: ${unsellable.length} product(s) are inactive or out of stock, ` +
        "so the model will not recommend them:"
    );
    for (const r of unsellable) console.warn(`  ${r.id} (active=${r.active}, stock=${r.stock})`);
  }
  console.log("all product ids present, model and shop agree");

  if (count !== products.length) {
    console.warn(
      `note: ${count} rows in the database but ${products.length} in the CSV. ` +
        "Expected if you seeded more phones earlier - not a failure."
    );
  }
}

main().catch((err) => {
  console.error("unexpected failure:", err);
  process.exit(1);
});
