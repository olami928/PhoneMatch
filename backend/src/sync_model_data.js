// sync_model_data.js — copies the two model data files the API needs into the
// backend, so a Netlify deploy actually contains them.
//
// WHY THIS EXISTS (measured, not assumed):
//   Netlify is deployed with base directory = `backend`. Two consequences:
//     1. `included_files` in netlify.toml CANNOT reference a path above the base
//        directory, so listing ../model/... is silently ignored.
//     2. esbuild bundles `netlify/functions/api.js`, so `__dirname` at runtime no
//        longer points at backend/src/. Any `path.join(__dirname, '..', '..',
//        'model', ...)` resolves into the zip and fails — but ONLY in production.
//        Locally it works, which is exactly how this class of bug survives.
//
// WHAT IT COPIES (and only these two):
//   model/config/questionnaire_v1.json  -> GET /questionnaire
//   model/data/phones.csv               -> CSV fallback when Supabase is absent
// Both are small text files. The 41 MB model artifact is NOT copied: it belongs
// to the Python service, not to this Node function (D35).
//
// DRIFT IS THE REAL RISK HERE. Two copies of the questionnaire config could
// disagree, and the shop would ask different questions from the ones the model
// scores. So `npm run check:model-data` fails loudly if the copies drift, and it
// is run in the deploy notes before every push.

const fs = require("fs");
const path = require("path");

const BACKEND_DIR = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(BACKEND_DIR, "..");
const DEST_DIR = path.join(BACKEND_DIR, "model_data");

const FILES = [
  { from: path.join("model", "config", "questionnaire_v1.json"), to: "questionnaire_v1.json" },
  { from: path.join("model", "data", "phones.csv"), to: "phones.csv" },
];

function copyOne(file) {
  const src = path.join(REPO_ROOT, file.from);
  const dest = path.join(DEST_DIR, file.to);

  if (!fs.existsSync(src)) {
    throw new Error(`Cannot copy ${file.from}: it does not exist at ${src}`);
  }

  const wanted = fs.readFileSync(src);
  fs.mkdirSync(DEST_DIR, { recursive: true });

  // Byte comparison, not mtime. The copies are committed, so they must be
  // updated whenever the originals change, or the deploy serves a stale
  // questionnaire while the model answers the new one.
  if (fs.existsSync(dest) && fs.readFileSync(dest).equals(wanted)) {
    return { file: file.to, changed: false };
  }

  fs.writeFileSync(dest, wanted);
  return { file: file.to, changed: true };
}

function sync() {
  const results = FILES.map(copyOne);
  const changed = results.filter((r) => r.changed);
  console.log(
    changed.length
      ? `model_data: updated ${changed.map((r) => r.file).join(", ")}`
      : "model_data: already up to date"
  );
  return results;
}

function check() {
  const stale = [];
  for (const file of FILES) {
    const src = path.join(REPO_ROOT, file.from);
    const dest = path.join(DEST_DIR, file.to);
    if (!fs.existsSync(dest)) {
      stale.push(`${file.to} (missing — run: npm run sync:model-data)`);
      continue;
    }
    if (!fs.readFileSync(dest).equals(fs.readFileSync(src))) {
      stale.push(`${file.to} (out of date — run: npm run sync:model-data)`);
    }
  }
  if (stale.length) {
    console.error("model_data is stale:\n  - " + stale.join("\n  - "));
    process.exitCode = 1;
    return false;
  }
  console.log("model_data matches model/config and model/data.");
  return true;
}

module.exports = { sync, check, DEST_DIR, FILES };

if (require.main === module) {
  if (process.argv.includes("--check")) check();
  else sync();
}