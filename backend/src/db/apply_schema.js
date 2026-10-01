// apply_schema.js — runs schema.sql and row_level_security.sql against Supabase.
//
// WHY THIS EXISTS: the SQL was written for the dashboard SQL editor, but the
// database is also reachable over the Supabase connection pooler on port 6543.
// Running it from here means the schema is applied the same way every time, and
// it can be re-run safely (every statement is `if not exists` / `drop policy if
// exists`).
//
// USAGE: node src/db/apply_schema.js
//
// This needs the DB password, not the anon or secret key. The secret key bypasses
// RLS but cannot run DDL; only a postgres connection can create tables.

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const FILES = ["schema.sql", "row_level_security.sql"];

function connection() {
  return new Client({
    host: process.env.SUPABASE_DB_HOST || "aws-0-eu-west-1.pooler.supabase.com",
    port: Number(process.env.SUPABASE_DB_PORT || 6543),
    database: process.env.SUPABASE_DB_NAME || "postgres",
    // The pooler requires the project ref in the username: postgres.<project-ref>
    user: process.env.SUPABASE_DB_USER,
    password: process.env.SUPABASE_DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });
}

async function main() {
  const required = ["SUPABASE_DB_USER", "SUPABASE_DB_PASSWORD"];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`Cannot run migrations, missing: ${missing.join(", ")}`);
    console.error("Set them in backend/.env (see .env.example).");
    process.exit(1);
  }

  const client = connection();
  try {
    await client.connect();
    console.log("Connected to the database.");
  } catch (error) {
    console.error(`Could not connect: ${error.message}`);
    console.error("If this says 'tenant/user not found', the pooler region in");
    console.error("SUPABASE_DB_HOST is wrong for this project.");
    process.exit(1);
  }

  let failed = false;
  try {
    for (const file of FILES) {
      const full = path.join(__dirname, file);
      const sql = fs.readFileSync(full, "utf8");
      process.stdout.write(`Applying ${file} ... `);
      try {
        await client.query(sql);
        console.log("ok");
      } catch (error) {
        failed = true;
        console.log("FAILED");
        console.error(`  ${error.message}`);
      }
    }

    // Prove the tables really exist rather than trusting the exit code.
    const { rows } = await client.query(
      `select tablename from pg_tables
        where schemaname = 'public' order by tablename`
    );
    const tables = rows.map((r) => r.tablename);
    console.log(`\nTables now present: ${tables.join(", ") || "(none)"}`);

    const rls = await client.query(
      `select relname, relrowsecurity from pg_class
        where relnamespace = 'public'::regnamespace and relkind = 'r'`
    );
    const secured = rls.rows.filter((r) => r.relrowsecurity).map((r) => r.relname);
    console.log(`RLS enabled on: ${secured.join(", ") || "(none)"}`);

    const expected = [
      "products",
      "profiles",
      "orders",
      "order_items",
      "order_status_history",
      "recommendation_sessions",
    ];
    const absent = expected.filter((t) => !tables.includes(t));
    if (absent.length) {
      console.error(`\nMISSING TABLES: ${absent.join(", ")}`);
      failed = true;
    }
  } finally {
    await client.end().catch(() => {});
  }

  process.exit(failed ? 1 : 0);
}

main();
