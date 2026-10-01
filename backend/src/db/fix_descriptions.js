// fix_descriptions.js — one-off repair for descriptions written by an older seed.
//
// THE PROBLEM: the first seed built each description by interpolating the CSV's
// spec values, which are floats ("8.0GB RAM, 256.0GB storage, 5200.0mAh battery").
// That text was then stored in the `products` table, so the shop shows decimals
// that no phone has. catalog.js now rounds before building the string; this
// script pushes the corrected text into rows that already exist.
//
// SAFETY: it only rewrites a description that still matches the EXACT old
// auto-generated pattern for that row's own specs. A description an admin has
// since rewritten by hand does not match, so it is left alone. That matters
// because Stage 7 makes this field editable.
//
// Run: node src/db/fix_descriptions.js
// Safe to re-run: after a repair the old pattern no longer matches, so the
// second run reports "nothing to do".

require("dotenv").config();
const path = require("path");
const { supabase, isConfigured } = require("../supabaseClient");
const { parseCsv } = require("../catalog");

// Reads the RAW csv rows, unrounded.
//
// This is the subtle part: catalog.js now rounds when it builds a description,
// so its `phone.description` is already the CORRECTED text. Matching the stored
// text against it would therefore never match, and this script would silently
// repair nothing. The old text has to be rebuilt from the CSV's raw, unrounded
// values — which is exactly what the first seed interpolated.
function rawCsvRows() {
  const csvPath = path.join(__dirname, "..", "..", "..", "model", "data", "phones.csv");
  const fs = require("fs");
  const rows = parseCsv(fs.readFileSync(csvPath, "utf8"));
  const header = rows.shift();
  return rows.map((cells) => {
    const row = {};
    header.forEach((key, i) => { row[key] = cells[i]; });
    return row;
  });
}

// The OLD catalog.js template, with the CSV's raw values interpolated as-is.
function oldDescription(row) {
  return (
    `${row.ram_gb}GB RAM, ${row.storage_gb}GB storage, ` +
    `${row.battery_mah}mAh battery, ${row.main_camera_mp}MP main camera.`
  );
}

// The NEW template, rounded the way catalog.js rounds now.
function newDescription(row) {
  const whole = (v) => Math.round(Number(v));
  return (
    `${whole(row.ram_gb)}GB RAM, ${whole(row.storage_gb)}GB storage, ` +
    `${whole(row.battery_mah)}mAh battery, ${whole(row.main_camera_mp)}MP main camera.`
  );
}

async function main() {
  if (!isConfigured()) {
    console.error(
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY."
    );
    process.exit(1);
  }

  const catalog = rawCsvRows();

  const { data: rows, error } = await supabase()
    .from("products")
    .select("id, description");
  if (error) {
    console.error("could not read products:", error.message);
    process.exit(1);
  }

  const byId = new Map(catalog.map((p) => [p.product_id, p]));
  let fixed = 0;
  let untouched = 0;

  for (const row of rows || []) {
    const phone = byId.get(row.id);
    if (!phone) continue;

    // Only touch rows whose stored text is byte-for-byte the old generated text.
    if (row.description !== oldDescription(phone)) {
      untouched += 1;
      continue;
    }

    const { error: updateError } = await supabase()
      .from("products")
      // newDescription(), NOT phone.description: `phone` is a raw CSV row here and
      // has no `description` property, so writing that would set the column to
      // null and blank out every product page.
      .update({ description: newDescription(phone) })
      .eq("id", row.id);

    if (updateError) {
      console.error(`could not update ${row.id}:`, updateError.message);
      process.exit(1);
    }
    fixed += 1;
  }

  console.log(`repaired ${fixed} description(s)`);
  console.log(
    `left ${untouched} alone (hand-written or already correct)`
  );
  if (fixed === 0) {
    console.log("nothing to do — this script is safe to run again");
  }
}

main().catch((err) => {
  console.error("unexpected failure:", err);
  process.exit(1);
});