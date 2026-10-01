// Netlify serverless entry point.
//
// Netlify runs this file for every request to /api/*. It wraps the same
// Express app used in local development, so behaviour stays the same in both
// places. See netlify.toml for the redirect that maps /api/* to this file.

const serverless = require("serverless-http");
const app = require("../../src/app");

exports.handler = serverless(app);
