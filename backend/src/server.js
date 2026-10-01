// Local development server. Run with: npm run dev
// It starts the same Express app used in production (see app.js).

const app = require("./app");

const port = process.env.PORT || 4000;

app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
  console.log(`Try: http://localhost:${port}/hello`);
});
