// Netlify serverless entry point.
//
// Netlify runs this file for every request to /api/*. It wraps the same
// Express app used in local development, so behaviour stays the same in both
// places. See netlify.toml for the redirect that maps /api/* to this file.

// On Netlify there is no .env file: secrets come from the dashboard's
// environment variables, which are already in process.env. dotenv is called
// anyway so that a stray local .env can never override a real deployed
// variable — if the file is absent, which is normal in production, this is a
// no-op.
require("dotenv").config({ override: false });

const serverless = require("serverless-http");
const app = require("../../src/app");

exports.handler = serverless(app);
