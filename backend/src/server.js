// Local development server. Run with: npm run dev
// It starts the same Express app used in production (see app.js).

// Load .env FIRST, before anything reads process.env. This line used to be
// missing, which meant the running server had no Supabase or Mailgun keys at
// all — a silent failure that looks like "the feature is not implemented yet".
require("dotenv").config();

const app = require("./app");

const port = process.env.PORT || 4000;

app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
  console.log(`Try: http://localhost:${port}/hello`);
  const mailgun = Boolean(process.env.MAILGUN_API_KEY);
  const supabase = Boolean(process.env.SUPABASE_URL);
  console.log(`  Supabase configured: ${supabase}`);
  console.log(`  Mailgun configured:  ${mailgun}`);
  if (!mailgun) {
    console.log("  (emails will be skipped and recorded, not sent)");
  }
});
