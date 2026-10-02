# AGENTS.md: Phone Shop Project Handoff

Read this file first. Update it last.

Any model or agent working on this project must follow the two rules below, in this order.

1. **At the start of a session:** read this whole file. Then read the "Status board" and the "Session log" so you know what happened and what to do next.
2. **At the end of a session:** update the "Status board", add an entry to the "Session log", and record any new decisions in the "Decision log". Do this even if the session was short or ended early.

Never rely on chat history. If it is not written in this file, the next agent will not know it.

---

## 1. Project summary

**One line:** a phone shop where shoppers answer a few questions and our own model tells them which phone fits their needs best.

**The core idea:** most people do not know which phone to buy. On the home page, the main button is "Use our model to find your phone". The shopper answers a short set of questions (budget, main use, top priority, storage, brand). The model returns a ranked list of phones from our own catalog, with a plain reason for each pick. The shopper can add any pick to the cart and check out. Browsing the full catalog is the second path, not the main one.

The shop also includes:

- A cart and checkout (guest checkout allowed)
- An admin area (products, stock, orders, model feedback)
- Google sign-in, data stored in a database, confirmation emails

**Why it exists:** a portfolio project and a real shop. The model is what makes it different from a plain store, so the model's quality decides whether the project succeeds.

**Owner:** Dimeji. Total beginner at full-stack projects. Strong in ML (built the first version of the model, which now needs to be reworked).

**Team (planned):** product designer, UX designer, UI designer, frontend developers, backend developers, the owner as ML developer and coordinator.

**Time pressure:** the owner has little time. Skip research and long discussions. Prefer decisions over options.

---

## 2. How to work with the owner

- Use simple, clear language and active voice. Be professional but not stiff. Do not sound like generated text.
- The owner is a beginner at web development, so explain web concepts in plain words before giving code. On ML topics, match the owner's level and do not over-explain basics.
- Work in small stages, shown step by step in the chat. Do not dump one giant block.
- Show results directly in the chat where possible, not as downloads.
- At the start of each stage, say what the stage will produce and how the owner can check it worked.
- When something fails, ask for the exact error message and where it happened.
- Do not change a confirmed decision silently. If you think a decision is wrong, say so, explain why, and let the owner decide. Then log the result.
- ANSWERED (Session 3, D25): the agent writes the code. The owner reviews and runs it.

---

## 3. Status board

**Last updated:** 2026-10-02 (Session 17)

**Current phase:** Model track **M1–M4 and M7 DONE, and the model service is now deployable** (containerised, Session 16). Shop track: Stages 2–5, 7, 9 done and **committed + pushed to GitHub**; Stage 1 verified locally; Stage 6 code complete but owner auth setup remains; Stage 8 code was committed in Session 16 but not end-to-end verified; Stage 10 core flow works but logging and feedback remain; Stage 11 not started. The local home, catalog and model chain all work (63 products, correct out-of-stock display, ranked results in ~1.6s). UI now uses a green/terracotta palette and has Chromium responsive checks from 320 to 1440px; Firefox/WebKit could not launch because system libraries are missing. **Nothing deployed to Vercel/Netlify/Render yet.** Rough estimate: about **80% of local functionality** and **45% of launch readiness**; milestone estimates, not measured coverage.

| Item | Status |
|---|---|
| PRD v1.2 (sections 4 to 15) | Done |
| Design: kickoff and wireframes | Simulated only, not done by real designers |
| Usability test | Simulated only. Real test with 3 people still needed (Stage 11) |
| Existing model | **Audited (M1, Session 4).** Python 3.12, transparent weighted scorer + a Random Forest distilled from it. Lives in `model/legacy/`. No real labeled data |
| Model rework | M1–M4 done. Random Forest ships (D34). `model/data/phones.csv` (63 phones, 0 missing), `shop_recommender.recommend()`, 10/10 personas pass. Next: M5 |
| **Deployability** | **FIXED (Session 16).** `model/service/Dockerfile` trains the model at build time; `backend/model_data/` ships the two runtime data files; README has exact steps for all three services. **Verified by building from a clean copy.** **Model compressed to 13.5 MB (was 41 MB), loads 0.93s (was 18.4s)** |
| Repo on GitHub | **YES — `main` pushed, latest `4ebcbda`** (first time in 15 sessions) |
| Shop Stage 1 | **Built and VERIFIED locally (Session 7).** Next.js 16.3.8 serves the page, backend CORS returns the right origin. Not deployed yet |
| UI and responsiveness | **UPDATED (Session 17).** Blue replaced with deep green + restrained terracotta and neutral surfaces. Home, catalog, questionnaire, cart and checkout checked in Chromium at mobile/tablet/desktop widths; cart overflow fixed. Firefox/WebKit downloads completed, but launch is blocked by missing host libraries |
| Code written | Yes: backend (Node/Express) + frontend (Next.js) + **model service (FastAPI, containerised)** + `API_CONTRACT.md`, `README.md` |
| Agent role | Agent writes the code, owner reviews and runs it (D25) |
| Accounts created (Supabase, Mailgun, Google Cloud, Vercel, Netlify) | Supabase and Mailgun **live and working**. Google Cloud **not set up** (blocks Google sign-in). Vercel/Netlify/Render **not connected to the repo yet** |

### Next action for the next agent

1. **OWNER: deploy, in this order** (README "Deploying" has the exact clicks):
   **(a) Model service first** — Render, Docker, `model/service/Dockerfile`. Use a **paid/trial instance, NOT the free tier**: it sleeps 30–60s, longer than Netlify's 10s function limit. **(b) Backend** — Netlify, base directory `backend`, set `MODEL_SERVICE_URL` + `ALLOWED_ORIGINS` + the Supabase/Mailgun keys. **(c) Frontend** — Vercel, root directory `frontend`, set `NEXT_PUBLIC_API_URL=https://<netlify-site>/api` and the two `NEXT_PUBLIC_SUPABASE_*` values.
   Code is on GitHub (`main` = `4ebcbda`), so all three can be connected now.
2. **OWNER ACTION, THE ONLY THING BLOCKING GOOGLE SIGN-IN.** Verified against
   the live project: `GET /auth/v1/settings` reports `"google": false`, and
   `GET /auth/v1/authorize` answers **400 `Unsupported provider: provider is not
   enabled`**. So the code is complete and correct, and one dashboard switch is
   the whole gap. Run `./scripts/check-google-auth.sh` to see the state and the
   fix; it queries Supabase directly rather than trusting the UI.
   Then: Supabase → Authentication → Providers → Google → **ON** + Client ID and
   Secret; add `https://<vercel-domain>/auth/callback` (and
   `http://localhost:3000/auth/callback`) to Redirect URLs; set
   `profiles.role = 'admin'` for the first admin.
3. **Verify the deployed recommendation chain** with the three curl commands at the end of README "Deploying". A "model not available" response means `MODEL_SERVICE_URL` is wrong or the model service is asleep.
4. **Stage 10's remaining gaps:** `recommendation_sessions` logging and the "Was this helpful?" feedback buttons (feature 11).
5. **Rotate the Supabase DB password and the Mailgun private key.** Both are in the chat history.
6. Complete Stage 8 end-to-end checks, then Stage 11 (real usability test with 3 people, admin model page).

**Update (Session 3):** a full phase plan (A to G) is at the end of the Session 3 entry.

**Update (Session 4):** the model and data arrived at the repo root (`src/`, `data/`). They were moved
into `model/legacy/` to match D26, and `*.joblib` was added to `.gitignore` so the 42 MB artifact is
never committed. Phase B (M1) is complete. The rule-based path was run and produces sensible results.
The bottleneck now is the frontend `npm install` (very slow network), which blocks the Stage 1 browser
check. Do that check first, then go straight to M2.

---

## 4. Decision log

Status: **Confirmed** means the owner said it. **Assumed** means an agent chose it and the owner has not confirmed it.

| # | Decision | Status |
|---|---|---|
| D1 | Build a shop with checkout, database, Mailgun emails, and Google auth | Confirmed |
| D2 | Database is Supabase (Neon was an allowed alternative) | Assumed (Supabase chosen for built-in Google auth) |
| D3 | Integrate the owner's phone recommendation model | Confirmed |
| D4 | Plan with a PRD first | Confirmed |
| D5 | Team includes designers, product designers, UI/UX designers, coders | Confirmed |
| D6 | Skip the research phase, use assumptions plus a quick usability test | Confirmed |
| D7 | Include an admin side | Confirmed |
| D8 | Frontend and backend hosted separately on Vercel and Netlify | Confirmed |
| D9 | Frontend on Vercel, backend on Netlify (not the other way round) | Assumed |
| D10 | Frontend is Next.js (UI only), backend is Node.js with Express running as Netlify Functions | Assumed |
| D11 | ML service is Python with FastAPI, hosted on Render or Railway | Assumed |
| D12 | Guest checkout allowed, Google login optional, login unlocks order history | Assumed (from simulated kickoff) |
| D13 | Recommendation form has 4 questions | Replaced by D21 |
| D14 | Each recommendation shows a "why this phone" line, not a match percentage | Assumed |
| D15 | Mobile first, light theme, one accent color | Assumed |
| D16 | Payments are simulated in v1, Paystack later | Assumed |
| D17 | Currency is naira | Assumed, needs confirming |
| D18 | The shop is model-led: the main call to action is "use our model to find your phone". Shoppers answer questions and the model recommends the best phone for their needs | Confirmed |
| D19 | The existing model will be reworked to fit this shop | Confirmed |
| D20 | The questionnaire is the front door: main hero button on the home page, a main navigation item, and a fixed button on mobile. Browsing the catalog is secondary | Assumed |
| D21 | The questionnaire has 5 questions, never more than 6: budget range, main use, top priority, storage need, preferred brand (optional). The final set is frozen at step M2 | Assumed |
| D22 | Model approach: v1 starts with a baseline scoring model (budget filter plus weighted match of answers to phone specs). Upgrade to a trained supervised model once enough labeled data exists. The owner decides, because this depends on what data exists | Assumed |
| D23 | Every recommendation session is logged (answers, results, model version, feedback, add-to-cart, purchase) to support evaluation and retraining | Assumed |
| D24 | Site wording must describe what the model really does. Do not claim it "predicts" or uses "AI" beyond what is built | Assumed |
| D25 | The agent writes the code. The owner reviews and runs it | Confirmed (Session 3) |
| D26 | One Git repo (monorepo) with folders `frontend/`, `backend/`, `model/`, `docs/`. `AGENTS.md` and `API_CONTRACT.md` live in the root | Assumed (Session 3, owner delegated planning) |
| D27 | Hosting split Vercel (frontend) plus Netlify (backend) is kept. Build and test everything locally first. Create cloud accounts only when a stage needs them | Assumed (Session 3) |
| D28 | Launch catalog: a CSV file in `model/data/phones.csv` is the single source of truth for specs. Stage 3 seeds Supabase `products` from it. Target 30 to 50 phones, at least 5 per budget band | Assumed (Session 3). **Partly superseded by D30** — we already have 63 priced phones; still need 5 per budget band check and the missing spec fields |
| D29 | Assume no labeled data. Build the baseline (M4) first. M5 only happens if the uploaded data proves otherwise | Assumed (Session 3), confirm after the upload |
| D30 | Catalog source is confirmed: `model/legacy/data/phone_catalog_ng.csv` — 71 phones, 63 with a verified price, 8 brands (TECNO 20, Apple iPhone 15, Samsung 12, itel 6, Xiaomi 6, Infinix 5, OPPO 4, Google Pixel 3). It replaces the "create phones.csv from scratch" assumption in D28 | Confirmed (Session 4, from the owner's upload) |
| D31 | v1 ranking engine is the transparent weighted scorer (`scoring.py`). The Random Forest is NOT shipped: it is trained on the scorer's own output (distillation), so it cannot beat the rules and reflects no real buyers. Kept for the record; reconsidered at M5 with real feedback and orders. Confirms D22 and D29 | **REPLACED by D34** (owner rejected the recommendation, Session 5) |
| D32 | The legacy model was uploaded to the repo root and moved to `model/legacy/` (`src/` + `data/`) to match D26. `*.joblib` is git-ignored (42 MB, regeneratable with `train_model.py`) | Assumed (Session 4) |
| D33 | M2 must MAP the D21 questionnaire (5 questions, one "top priority") onto the legacy input shape (4 separate low/medium/high priority sliders and a single budget maximum). It is a design step, not a copy of the legacy inputs | Assumed (Session 4) |
| D34 | **v1 ranking engine is the Random Forest (`ml_recommender.py` + `src/ml_model.joblib`), NOT the rule-based scorer.** The owner decided this after being shown the distillation finding. The agent's recommendation was recorded and declined; the owner accepted the trade-offs knowingly. `scoring.py` is still used — but only to generate the reason lines and ratings, not to rank. Owner is the ML developer (D5), so the model design is the owner's call | Confirmed (Session 5) |
| D35 | Because the RF artifact is 41 MB and takes 5.5s to load cold, the model MUST be a long-lived Python service with a warm process (M7 on Render/Railway, or a persistent container). It must NOT be loaded inside a Netlify serverless function, which has a hard execution limit and no warm state. This is a firm constraint, not a preference | Assumed (Session 5, from measured load times) |
| D36 | The `products` table is the source of truth for **price and stock**; `model/data/phones.csv` is the source of truth for the **specs the model scores**. Both use the same `product_id`, which is what keeps the two from drifting apart. A product detail rename or stock change made in admin is immediately true in the shop | Confirmed (Session 13, built as Stage 3) |
| D37 | The backend sends the model the ids that are currently sellable, and the model applies them as an **intersection** — it can only remove candidates, never add. This replaces the Session 7 decision to reject `candidate_ids` outright, which was correct when the CSV was the only source of stock but would let the model recommend sold-out phones once orders started decrementing the database. The hard filters still run afterwards, so nothing can be smuggled past budget, storage, stock or active | Confirmed (Session 13) |
| D38 | Identity is decided ONLY by the verified Supabase token plus the `profiles.role` column. A role in a request body or in a JWT claim is ignored. Token verification uses the **publishable** key on purpose: using the secret key would make the auth path depend on a privileged credential, and a missing one would silently sign everyone out instead of failing loudly. The first admin is promoted by hand, so admin is never self-assignable at signup | Confirmed (Session 13) |
| D39 | Sign-in offers **both** Google and email+password as equal choices, not one with the other as a fallback. The owner asked for a non-Google path explicitly. This means email confirmation must stay ON: it is the only thing stopping a stranger creating a usable account with somebody else's address (measured in Session 13). `mailer_autoconfirm` is now a locked setting | Confirmed (Session 13, owner request) |
| D40 | The Supabase `sb_publishable_` key is treated as public, not as a secret. It is designed to be in the browser bundle and its power is bounded by RLS; sign-in cannot work without it. Only `sb_secret_` is a leak. `scripts/check-for-secrets.sh` was narrowed to match, after verifying the bundle held no secret key — and re-verified by planting a real fake `sb_secret_` in a tracked file and in the build output, both of which still fail the build | Assumed (Session 13, verified) |
| D41 | Storefront palette uses deep green `#16745d` as the primary, darker green `#105b49` for emphasis, pale green/terracotta tints on neutral surfaces, and coral `#e97859` only as a decorative accent. The green/coral hues are near-complementary; white on the primary is 5.69:1, while coral on white is 2.88:1 and therefore is not used for small text | Assumed (Session 17, based on Material color-role guidance and WCAG contrast) |

When a decision changes, add a new row. Do not delete old rows. Mark the old one "Replaced by D#".

---

## 5. Goals and non-goals

**Goals**

- A shopper can answer the questions, get a ranked list of phones with reasons, and order one without help
- The model's recommendations are sensible for a wide range of needs and always respect the budget
- Products, users, orders, and recommendation sessions are stored in Supabase
- A confirmation email is sent after every order
- Google sign-in (optional for shoppers, required for admin)
- Admin can manage products, stock, orders, and see how the model is performing
- Frontend and backend deploy and scale separately
- The model can improve over time using logged feedback

**Non-goals for v1**

- Real payments
- Reviews, wishlists, mobile app
- Personalized recommendations based on a user's past behavior (v1 uses only the questionnaire answers)

---

## 6. Features

| # | Feature | Priority |
|---|---|---|
| 1 | Questionnaire: "Use our model to find your phone" | Must |
| 2 | Results page: ranked phones with a reason, ratings, and add to cart | Must |
| 3 | Product list and detail pages | Must |
| 4 | Cart | Must |
| 5 | Checkout (guest or signed in) | Must |
| 6 | Database for products, orders, order items, recommendation sessions | Must |
| 7 | Google login | Must |
| 8 | Confirmation email | Must |
| 9 | Price filter on product list | Must |
| 10 | Delivery cost estimate in cart | Must |
| 11 | Result feedback ("Was this helpful?" yes or no) | Must |
| 12 | Edit answers and re-run without starting over | Should |
| 13 | Order history | Should |
| 14 | Compare 2 to 3 phones | Should |
| 15 | "How our model works" short page (builds trust) | Should |
| 16 | Real payments | Later |
| 17 | Admin login (admin accounts only) | Must |
| 18 | Admin dashboard (orders today, revenue, pending) | Should |
| 19 | Admin product management with image upload and full spec fields | Must |
| 20 | Stock tracking (0 stock hides Add button, shows "Out of stock", and removes the phone from recommendations) | Must |
| 21 | Admin order management and status updates | Must |
| 22 | Status update emails to customers | Should |
| 23 | New order alert email to admin | Should |
| 24 | Admin model page: recommendation counts, feedback rate, top recommended phones, model version | Should |
| 25 | Customer list | Later |
| 26 | Warning in admin when a new product has missing model features | Should |

**Order statuses:** Pending, Paid, Packed, Shipped, Delivered, Cancelled.

---

## 7. Architecture

| Part | Choice | Hosted on |
|---|---|---|
| Frontend (shop and admin UI) | Next.js, UI only | Vercel |
| Backend API | Node.js with Express as serverless functions | Netlify |
| Database, auth, image storage | Supabase | Supabase |
| Email | Mailgun | Called from the backend |
| Model service | Python with FastAPI | Render or Railway |

```
Browser (Vercel) --> Backend API (Netlify) --> Supabase
                                          --> Mailgun
                                          --> Model service
```

- The frontend only talks to the backend and to Supabase Auth for sign-in. It never calls Mailgun or the model service.
- The frontend sends the user's login token with every backend request (guests have no token and can only use public routes).
- The backend verifies the token, reads the user's role, and blocks admin routes for non-admins.
- Every phone the model can recommend must exist in the `products` table with the same ID.

**Recommendation flow**

1. The shopper answers the questions in the frontend.
2. The frontend sends the answers to `POST /recommend` on the backend.
3. The backend loads the in-stock, active phones and calls the model service with the answers.
4. The model service returns ranked phone IDs with scores, reasons, and ratings.
5. The backend saves the session in `recommendation_sessions`, joins the phone data, and returns the results.
6. The frontend shows the results and the feedback buttons.

### API routes (outline)

| Route | Who |
|---|---|
| `GET /products`, `GET /products/:id` | Everyone |
| `POST /recommend` | Everyone |
| `POST /recommend/:sessionId/feedback` | Everyone |
| `POST /orders` | Guests and users |
| `GET /orders/mine` | Signed-in users |
| `POST /admin/products`, `PUT /admin/products/:id` | Admin only |
| `GET /admin/orders`, `PATCH /admin/orders/:id/status` | Admin only |
| `GET /admin/model/stats` | Admin only |

Backend and frontend must agree on route shapes in writing before building. Keep the agreed shapes in a file named `API_CONTRACT.md` in the repo and update it whenever a route changes.

### Model service contract (draft, to be frozen at step M7)

Request from backend to model service:

```
POST /recommend
{
  "budget_min": 150000,
  "budget_max": 300000,
  "main_use": "photos",
  "priority": "camera",
  "min_storage_gb": 128,
  "brand_preference": null,
  "candidate_ids": ["p_101", "p_102", "..."],
  "top_n": 5
}
```

Response:

```
{
  "model_version": "baseline-0.1",
  "recommendations": [
    {
      "product_id": "p_101",
      "score": 0.87,
      "reasons": ["Strong camera for its price", "Within your budget"],
      "ratings": { "camera": "Excellent", "battery": "Good", "performance": "Good" }
    }
  ]
}
```

Also expose `GET /health` and `GET /version`.

---

## 8. Model workstream

The model is the heart of the product. This track runs in parallel with the shop stages.

### Current model audit (M1 — DONE, Session 4)

Uploaded by the owner and moved to `model/legacy/` (code in `model/legacy/src/`, data in `model/legacy/data/`).

```
Framework / language:
  Python 3.12. pandas + numpy for data, scikit-learn (RandomForestRegressor) for the
  ML variant, joblib for the saved artifact. No notebook — plain scripts with docstrings.

Files (model/legacy/src/):
  data_processing.py     load catalog from CSV, drop rows with no verified price,
                         add brand_norm and a hand-written processor_tier (0-100 heuristic)
  generate_customers.py  make 600 SYNTHETIC customers (seed 42)
  scoring.py             transparent weighted scoring, no ML. Every component 0-100.
                         budget/camera/battery/storage/performance/brand scores, compute_weights
  build_training_data.py score every (synthetic customer x in-budget phone) pair with
                         scoring.py -> training_data.csv  (this is DISTILLATION)
  train_model.py         train the Random Forest on training_data.csv, GroupKFold by
                         customer_id, print MAE + R^2, save src/ml_model.joblib (42 MB)
  recommender.py         RULE-BASED ranking: score all phones, drop far-over-budget ones,
                         top-N with a light same-brand diversity check, build "why" lines
  ml_recommender.py      same interface, but ranking comes from the Random Forest.
                         Explanations still come from scoring.py (ranking and reasons decoupled)

Training data (source, size, date):
  100% synthetic, created in this repo. Pipeline:
    model/legacy/data/phone_catalog_ng.csv ............ 71 phones (63 with a verified price)
    model/legacy/data/synthetic_customer_preferences.csv 600 customers (data_source=synthetic)
    model/legacy/data/training_data.csv ............... 13,993 rows x 22 cols (in-budget pairs)
  label == the rule-based target_score, i.e. the ML model is trained on the output of
  scoring.py. Creation date is not recorded in the files.

Input features (customer side):
  budget_ngn (a SINGLE maximum, no minimum), primary_use
  (general | social_media | camera | gaming | work | student),
  camera/battery/performance/storage priority each in {low, medium, high},
  brand_preference (one brand or "Any").

Input features (phone side):
  price_ngn, ram_gb, storage_gb, battery_mah, main_camera_mp, selfie_camera_mp,
  processor_tier (0-100 heuristic), refresh_rate_hz, five_g, brand.

Output (what it returns):
  top 3 (n is a parameter): brand, model, price_ngn, match_score (0-100),
  remaining_budget, specs {...}, why[] (plain reason strings).
  No rating labels (Excellent/Good) and no model_version are returned.

Target / label (what it predicts):
  target_score = the deterministic weighted score from scoring.py.
  So the Random Forest learns to COPY the rules, not to predict real user preference.
  Max target in the data is ~80, mean 49, std 9.3.

How it was evaluated (metric, score):
  train_model.py, run in Session 4 with scikit-learn 1.9.1, 5-fold GroupKFold split by
  customer_id (no customer leakage):
    held-out rows: 2,799 customers' rows
    MAE:  1.19 points (target scale ~0-100)
    R^2:  0.969
  Top feature importances: price_to_budget_ratio 0.318, price_ngn 0.308, storage_gb 0.128,
  battery_mah 0.053, budget_ngn 0.040, refresh_rate_hz 0.037, camera_priority 0.037.
  Head-to-head check, rules vs forest, 4 personas (Session 5, this is the corrected evidence —
  the earlier 3-persona check in Session 4 was too small and is superseded):
    student NGN150k ....... IDENTICAL (Redmi A7 Pro, Power 70, Pop 10 Pro, A3X 4G, Galaxy A06)
    camera NGN300k ........ IDENTICAL (Super 26 Ultra, Camon 40, Redmi 15C, A3X 4G, Galaxy A06)
    gaming NGN900k ........ DIFFERENT (same 5 phones, rank 3/4 swapped: Camon 50 Pro 4G vs 17 Plus)
    work NGN2m, Samsung ... DIFFERENT (same 5 phones, rank 3/4 swapped: Note 60 Pro 5G vs 10)
    agreement 2/4 — where they differ, the SET is identical and only the order of two
    adjacent phones changes. That is regression noise around the same ranking, not new
    knowledge. On camera personas the two hardest to fake, it agrees exactly.
  Reading: R^2 0.97 means the forest has memorised the rules, which is expected because the
  label is a deterministic function of the features. The evidence now shows this precisely:
  the forest reproduces the rule ranking and adds only noise, not information.
  STILL TRUE AND RELEVANT EVEN THOUGH WE SHIP THE FOREST (see D34): the forest cannot
  reflect real buyers, because it was never shown any. Its quality ceiling is the rule
  scorer's quality. Measured runtime for the forest: 0.23-0.45s per prediction, 5.5s cold
  model load, 41 MB artifact.
  Still missing: a persona test set, a budget-violation check, and a check of the reason text.

What to keep:
  1. scoring.py — the transparent weighted scorer. This is exactly the D22 baseline.
     Budget decay curve, min-max normalization, the processor_tier heuristic, and the
     "drop the missing component and renormalize the weights" rule (never fabricate a value).
  2. The hard budget exclusion (phones >15% over budget score 0 and are dropped).
  3. The "why" reason generator built from real component scores, never invented text.
  4. The feature list and the processor_tier heuristic — reusable in the shop baseline.
  5. The catalog CSV carrying price source + verification date (good for the stale-data risk).
  6. Honest labelling: synthetic data is flagged and the distillation is documented in code.

What to change (for the shop):
  1. SHIP THE RANDOM FOREST as the v1 ranking engine — owner decision, see D34. This
     OVERRIDES the Session 4 recommendation below, which is kept as the record of what was
     analysed and why it was declined:
       ORIGINAL RECOMMENDATION (declined): do not ship the forest. It is trained to
       reproduce the rules, so it cannot beat the rules, cannot reflect real buyers, and
       costs 41 MB plus load time. Ship scoring.py as the baseline.
       WHAT WE DO INSTEAD: ranking comes from the forest via ml_recommender.py. scoring.py
       stays in the loop and is still required, because it generates the reason lines and
       the ratings. This is already how ml_recommender.py is written (ranking and reasons
       are decoupled), so no restructuring is needed.
       CONSEQUENCES THE OWNER HAS ACCEPTED: (a) quality ceiling stays the rule scorer, so
       M6 persona testing and M2 weight tuning still matter; (b) 41 MB + 5.5s cold load
       forces a warm persistent service (D35), not a serverless function; (c) the site
       wording rule D24 still applies — describe it as a model that matches specs to needs,
       not one that "predicts" what a buyer wants, because it never saw a real buyer.
  2. Add a stable product_id so model rows and Supabase products rows always match (M3).
  3. The questionnaire uses a budget RANGE; the model takes one maximum. Add budget_min
     and keep budget_max.
  4. Map the questionnaire answers onto the model inputs. Legacy uses 4 separate priority
     sliders; D21 asks only one "top priority". That mapping is an M2 job.
  5. storage is only a soft score today. It must become a hard minimum filter.
  6. Add in-stock / active filtering (the legacy code has no stock concept).
  7. Return top 5, add model_version, and add the rating labels the results page wants
     (Excellent/Good/Fair per category, derived from the component scores).
  8. Build reason lines from the TOP CONTRIBUTING feature instead of fixed thresholds.
     Evidence: a "camera" persona at NGN300k returned a #1 pick with only "Fits within your
     budget" + "Strong battery" and no camera reason at all.
  9. Weight tuning: budget_score gives any in-budget phone a floor of 70 points, which
     flattens differences and can let a cheaper phone outrank a better-matched one.
     Revisit the floors and the use-case boosts at M2/M4.
 10. Catalog gaps to fix at M3 — missing values: ram_gb 16, battery_mah 15,
     selfie_camera_mp 21, main_camera_mp 6, display_inches 6, processor 4,
     refresh_rate_hz 3, storage_gb 2, price_ngn 8. Missing entirely: id, stock, active,
     OS, description, image. Brands: TECNO 20, Apple iPhone 15, Samsung 12, itel 6,
     Xiaomi 6, Infinix 5, OPPO 4, Google Pixel 3. Price NGN98,100 to NGN2,868,608
     (median NGN556,000).
```

**Labeled data: none.** There is no data linking a real shopper's needs to the phone they
should get. `training_data.csv` is the rule scorer's own output. Open question 3 is
answered: v1 is the baseline (D22, D29 confirmed). The Random Forest cannot be counted as a
model trained on real behaviour.

**Verified runnable (Session 4).** With pandas + numpy the rule-based path runs end to end.
With a NGN500,000 camera persona it returns TECNO Camon 40 Pro 5G (NGN400,000, 67.1,
"Fits within your budget" + "Good camera for your priorities"), then Camon 50 Pro 4G and
Camon 50 4G — sensible. At NGN300,000 the same camera persona drops the camera reason
(see change 8). Note: `load_catalog` drops 8 unpriced phones, leaving 63.


### The data problem, in plain words

"Predicting the best phone for a person" needs examples of people's needs matched to phones that suited them. We probably do not have that on day one. So v1 can only rank phones by how well their specs match the shopper's answers. That is a scoring or content-based recommender, which is honest and works. Once the shop collects feedback and orders, that data can train a supervised model that learns what people actually prefer. The owner decides how far to take this (see D22 and open question 3).

### Starting questionnaire (draft, frozen at M2)

| # | Question | Answer type |
|---|---|---|
| 1 | What is your budget? | Preset ranges (no free typing) |
| 2 | What will you use it for most? | One of: photos and video, gaming, social media and streaming, calls and everyday use, work and study |
| 3 | What matters most to you? | One of: camera, battery life, performance, screen, lowest price |
| 4 | How much storage do you need? | Light, medium, heavy (mapped to GB) |
| 5 | Any brand you prefer? (optional) | Multiple choice or skip |

Rules: one question per screen on mobile, a progress bar, a "Back" button, and a "Skip" on the optional question. Never ask for personal information.

### Phone features the model needs (every catalog phone must have all of them)

Price (naira), brand, RAM, storage, rear camera main sensor (MP) and any camera score, battery (mAh) and fast charging, screen size and type, chipset and a performance score, OS and release year, 5G support, stock status.

### M2 — the frozen answer-to-feature map (DONE, Session 5)

The questionnaire is frozen as `model/config/questionnaire_v1.json` (the single source of truth the team tunes, no code changes) and the bridge to the model is `model/src/questionnaire_mapper.py`. Nothing here is a guess: every mapping was run against the real 63-phone catalog and the real forest.

**The problem being solved (D33).** The forest was trained on 4 separate low/medium/high priority sliders and a single budget maximum. The shop asks ONE "what matters most" question and a budget RANGE. So answers must be folded onto the trained inputs. Critically, `score_catalog_ml` reindexes to `MODEL_COLUMNS` with `fill_value=0`, so **any input the forest was not trained on is silently ignored.** The map therefore never invents an input.

| # | Question (asked) | Answers | Maps to model input | Notes |
|---|---|---|---|---|
| 1 | What is your budget? | 6 preset ranges | `budget_ngn` = the range MAX | Model has no `budget_min`. `budget_min` is kept for reporting only, never as a filter — someone picking NGN 300k–500k should still see a great NGN 280k phone |
| 2 | What will you use it for most? | photos/video, gaming, social+streaming, calls+everyday, work+study | `primary_use` = camera / gaming / social_media / general / work | All 5 map to real trained values. Note the model also knows `student` (107 training rows) which no question uses — kept in reserve, not dead code |
| 3 | What matters most to you? | camera, battery, performance, screen, lowest price | 4 priority sliders, see below | The one-to-four fold |
| 4 | How much storage do you need? | light 64 / medium 128 / heavy 256 | `storage_min_gb` HARD filter + `storage_priority` | Was only a soft score before; now a hard floor, as the audit required |
| 5 | Any brand you prefer? (optional) | 8 brands + no preference | `brand_preference` | Only 5% weight in the scorer, so it nudges, never overrides specs or price |

**The one-to-four fold (question 3).** Chosen priority becomes `high`; the others become `medium` (not `low`, so the un-chosen categories are not punished). Storage is the exception: it is set by question 4 only (light=low, medium=medium, heavy=high) and `top_priority` never overrides it.

**Two answers the model cannot express honestly. Both are documented in the config `why` fields rather than faked:**

- **"Screen"** has no model input. Refresh rate is part of `performance_score`, so Screen folds into `performance`. **M3 should give screen a real feature if the team agrees buyers care about it.**
- **"Lowest price"** cannot be expressed at all: the budget weight is fixed at 0.30 and no slider moves it. Honoured by the 75% price cap plus a cheapest-first re-sort instead. MEASURED PROOF this was needed: with a NGN 500k–1m budget the forest put a NGN 556,000 Infinix at #1 while a NGN 98,100 Redmi 13C was in the candidate set. The cap filters, the re-sort orders.

**Hard filters run BEFORE the forest, never after (D34).** `apply_hard_filters` enforces price cap (no overage tolerance, unlike the 15% in `scoring.py`), storage floor, stock > 0, and active. Verified: all 18 budget × storage combinations return at least one candidate, and no persona ever got an over-budget or under-storage phone.

### M4 — the shop recommender `model/src/shop_recommender.py` (DONE, Session 7)

One entry point, `recommend(answers)`, in the order the model rules demand:

```
1. map_answers()        5 answers -> the 7 customer keys the forest reads
2. apply_hard_filters() price cap, storage floor, stock > 0, active   <-- BEFORE scoring
3. top_recommendations_ml()   the Random Forest ranks the survivors
4. scoring.py           builds reason lines and Excellent/Good/Fair ratings
```

**Step 2 before step 3 is the whole point of this step.** The forest regresses a score and cannot enforce a rule (D34). Filtering after scoring would be trusting its output; filtering before means an unbuyable phone never reaches it.

Returns what `POST /recommend` needs: `model_version` (`rf-shop-0.1`), `product_id`, `rank`, `reasons[]`, `ratings{camera,battery,performance}`, `specs{}`, `total_candidates`, and `message` when the catalog is too thin to fill 5 slots.

**Fixes audit change 8 (reason lines).** `_why()` picks the leading line from the shopper's stated use, so a camera persona now gets the camera reason first. The legacy version could return a camera pick whose only reasons were "fits your budget" and "strong battery".

**Imputed specs are disclosed to the shopper.** A pick with guessed specs carries "Some specs on this phone are estimates, not confirmed". No invented data is presented as fact (D24).

**`model/src/test_personas.py` — the acceptance check.** 10 personas, and it exits non-zero on any hard-rule violation, so it can be run in CI later. Hard rules checked on every persona: never over budget, never under the storage floor, never out of stock, never inactive, ranks sequential, every pick has a reason.

**Result: 10/10 pass, all hard rules held.** Set all `stock=0` → 0 candidates. Set all `active=False` → 0 candidates. Both confirmed, not assumed.

**Measured weak spots, not bugs:**
- "Cheapest possible, heavy storage" (NGN1m–2m) returns the NGN98,100 Redmi 13C first. Correct — the shopper asked for lowest price — but it means a flagship budget can legitimately produce a budget phone.
- "Flagship, camera" #1 is a TECNO Phantom V Fold 2 rated **camera Fair**. The forest ranks on its distilled target, which knows nothing about folding screens. Worth a look at M5/M6.
- Cheapest band + light storage has only **3 candidates**; the shop must handle a 3-result page gracefully. The `message` field exists for exactly this.

### M3 — the launch catalog `model/data/phones.csv` (DONE, Session 6)

Built by `model/src/build_phones_csv.py` (re-runnable; regenerates the CSV from the legacy scrape). **63 phones**, 30 columns, **zero missing values**, unique `product_id`.

**The id rule that matters.** A plain slug COLLIDES: `Galaxy S26` and `Galaxy S26+` both became `samsung-galaxy-s26`, same for `S25/S25+`, `Spark 40 Pro/Pro+`, `itel A200/A200+`. 4 collisions. Fixed by mapping `+` to `plus` before slugging, plus a stable numeric suffix as a second guard. All 63 ids verified to join back to the legacy catalog — 0 unmatched. This is the catalog-mismatch risk in section 15, now closed for the model side.

**Missing specs were NOT invented silently.** 25 of 63 phones had at least one gap. Each is imputed from the **median of the same brand within the same price tier** (not a global median — a budget phone must not inherit a flagship battery), and recorded in `imputed_fields` plus a per-column `*_imputed` flag. `processor` is text so it uses the mode, never a median.

| Field | Imputed | Field | Imputed |
|---|---|---|---|
| selfie_camera_mp | 18 | display_inches | 6 |
| ram_gb | 16 | main_camera_mp | 3 |
| battery_mah | 15 | refresh_rate_hz | 3 |
| storage_gb | 1 | processor | 2 |

**38 phones have every measured spec.** These are the trustworthy rows.

**Two bugs the checks caught (both would have shipped silently):** (1) an `IndexError` from filtering rows before building a positional list; (2) `imputed_fields=""` was written as an empty string, which pandas reads back as **NaN** — so "zero missing values" was true at write time and false on reload. Fixed with a `none` sentinel.

**New columns the legacy CSV never had:** `stock` (default 10) and `active` (default True). These exist so `apply_hard_filters` can enforce them. Verified they bite: set all stock=0 or all inactive and candidates drop to **0**.

**Catalog shape — the thin bands are real:**

| Budget band | Phones |
|---|---|
| 0 – 150k | 14 |
| 150k – 300k | 9 |
| 300k – 500k | 8 |
| 500k – 1m | 16 |
| 1m – 2m | 14 |
| 2m+ | **2** |

The **2m+ band has only 2 phones** and heavy storage under NGN150k has only **1** (Redmi 13C). These are the expansion targets for M5. Not a bug — a measured catalog limit.

**Still open (owner decision):** whether "screen" becomes a real model feature. `display_inches` and `refresh_rate_hz` are now clean in the CSV, so M5 can add it without re-scrape.

### Steps

| Step | What | Done when | Status |
|---|---|---|---|
| M1 | Audit the existing model and data. Fill in the box above. Decide what to keep | Audit written down in this file | **Done** (Session 4) |
| M2 | Freeze the questionnaire and a feature map: each answer maps to which phone features and weights | A table in this file mapping every answer to features, frozen as v1 | **Done (Session 5)** |
| M3 | Build the phone dataset: all required features for every catalog phone, with IDs matching the `products` table | No missing values; IDs match | **Done (Session 6)** |
| M4 | Shop recommender: hard filters (budget, stock, storage) THEN the Random Forest ranks, then top 5 with reasons from scoring.py. The hard filters are what must be new — the forest cannot enforce budget or stock itself | Runs locally and gives sensible results for 10 test personas | **Done (Session 7)** |
| M5 | Retrain and improve the forest once real data exists. Sources in order: team-labeled personas, then real feedback and orders. Until then it can only reproduce the rule scorer (see D34) | Beats the current forest on the persona test set | Not started |
| M6 | Evaluate. Build a test set of at least 20 personas (varied budgets and needs) with acceptable answers agreed by the team. Check hard rules | Target met (assumed: an acceptable phone is in the top 3 for at least 80% of personas; budget is never exceeded; out-of-stock phones never appear) | Not started |
| M7 | Package as FastAPI with `/recommend`, `/health`, `/version`. Deploy to Render or Railway. Freeze the contract | The backend gets results in under 3 seconds | **Service DONE locally (Session 10), NOT deployed** |
| M8 | Feedback loop: sessions logged, feedback and orders linked to sessions, retraining plan agreed | Admin model page shows real session data | Not started |

### Model rules (apply to every version)

- Never recommend a phone that is out of stock, inactive, or above the budget maximum.
  **CRITICAL WITH THE FOREST (D34):** a Random Forest regresses a score, it cannot enforce a
  constraint. The forest has no concept of stock, active, or budget_min. These hard rules MUST
  be enforced by filtering the candidate list BEFORE the forest scores anything — never by
  trusting or post-filtering its output. Pass candidates in, not scores out.
- Always return a reason per phone, built from real features, never invented text.
- Always return a `model_version`, and store it with each session.
- Handle ties and thin catalogs: if fewer than 3 phones match, return what exists and say so, and suggest widening the budget.
- Keep the scoring weights and feature map in a config file so the team can tune them without code changes.
- Do not store personal data in sessions. Use an anonymous session ID unless the user is signed in.

---

## 9. Data model

- **products:** id, name, brand, price, description, image, `stock`, `active`, plus the model features from section 8 (RAM, storage, camera, battery, screen, chipset score, OS, year, 5G)
- **profiles:** user id, email, `role` (customer or admin). The first admin is set by hand in Supabase.
- **orders:** id, user (nullable for guests), email, total, status, shipping details, created date
- **order_items:** order, product, quantity, price at purchase
- **order_status_history (optional):** order, status, changed by, time
- **recommendation_sessions (new):** id, user (nullable), anonymous session id, answers (JSON), results (JSON), model_version, feedback (helpful yes or no, optional comment), added_to_cart (product ids), purchased (product ids), created date

---

## 10. Pages

**Shop:** Home, Questionnaire (Help me choose), Results, Product list, Product detail, Cart, Checkout, Order confirmation, Order history, How our model works.

**Admin:** `/admin` dashboard, `/admin/products`, `/admin/orders`, `/admin/orders/[id]`, `/admin/model`.

**Home (wireframe)**

```
[Logo]   Find my phone   Shop   Cart(0)   Sign in
----------------------------------------------------
  Not sure which phone to buy?
  Answer 5 quick questions. Our model picks for you.
  [ Find my phone ]          Browse all phones

  Popular phones
  [img]     [img]     [img]     [img]
```

**Questionnaire (wireframe, one question per screen)**

```
Question 2 of 5  [=====-----]
What will you use it for most?
( ) Photos and video     ( ) Gaming
( ) Social and streaming ( ) Calls and everyday
( ) Work and study
[ Back ]                         [ Next ]
```

**Results (wireframe)**

```
Your top picks
----------------------------------------------------
[img] #1 Phone A                  ₦000,000
      Strong camera for its price, within your budget
      Camera: Excellent · Battery: Good · Performance: Good
      [ Add to cart ]   [ View details ]
[img] #2 Phone B ...

Was this helpful?  [ Yes ] [ No ]      [ Change my answers ]
```

Key design rules from the simulated kickoff and usability test:

- The model entry point is visible on every page, including a fixed button on mobile.
- Show the delivery estimate in the cart, not only at the last step.
- Add a price range filter to the product list.
- Compress images and lazy-load them.
- Next to the Google button, show "Continue as guest".
- Results show a reason line plus 2 to 3 rating labels. No match percentage.
- Budget uses preset ranges, not free typing.

**Warning:** the usability findings are simulated guesses, not real research. Validate with 3 real people in Stage 11, and test the questionnaire specifically.

---

## 11. Security and config rules

- The Supabase service key and the Mailgun key live only in Netlify environment variables. The frontend gets only the public Supabase URL and anon key.
- The model service accepts calls only from the backend (shared secret header).
- The backend accepts requests only from the Vercel domain (CORS).
- Turn on Supabase row-level security so shoppers can only read their own orders and sessions.
- Admin checks happen on the backend, not only by hiding buttons.
- Add the Vercel production and preview domains to the Google OAuth redirect URLs (Google Cloud Console and Supabase).
- Keep separate environment files for local, staging, and production. Never commit secrets to GitHub.
- Mailgun sandbox only sends to approved addresses. Add test emails first.

---

## 12. Team and workflow

| Role | Owns |
|---|---|
| Product designer | Scope, priorities, assumptions, questionnaire wording |
| UX designer | Flows, wireframes, questionnaire and results experience, usability tests |
| UI designer | Style, components, mockups, prototype, email template |
| Frontend developers | Shop, questionnaire, results, and admin screens |
| Backend developers | API, database, auth, Mailgun, role checks, session logging |
| ML developer (owner) | Model rework, dataset, evaluation, FastAPI service, reason lines |

- **Design:** Figma with a shared style guide and component library. Same component names in Figma and code (ProductCard, CartItem, Button, FormField, QuestionStep, ResultCard). Design tokens shared with the Tailwind config. Storybook for reviewing components.
- **Code:** GitHub with `main` always working, feature branches, one review per pull request. Pushing to `main` deploys to Vercel and Netlify. Pull requests get preview links.
- **Environments:** local, staging, production.
- **Board columns:** Backlog, Design, Ready for Dev, In Progress, Review, Done.
- **Definition of done:** matches the approved design, works on mobile and desktop, passes the accessibility checklist (WCAG AA contrast, keyboard use, alt text, form labels, large touch targets), reviewed, tested on staging.
- **Model changes** need a new `model_version` and a re-run of the persona test set before they go live.

---

## 13. Build stages (shop)

Do the stages in order. Do not start a stage until the one before it is marked Done and the owner confirms. The model steps in section 8 run in parallel. Stage 10 needs model step M7.

| Stage | What gets built | Done when | Status |
|---|---|---|---|
| 1 | Frontend (Vercel) and a hello-world backend (Netlify), connected | The frontend shows a message fetched from the backend, both deployed | **Built and verified locally (Sessions 4, 7). NOT deployed** |
| 2 | Product list, price filter, cart (fake data) | Browse, filter, and add to cart work locally | **DONE (Session 9), verified live locally** |
| 3 | Supabase tables with real products and model features | The product list loads from the database | **DONE (Session 13).** Schema applied, RLS on, 63 products seeded. `GET /products` and `GET /products/:id` now read the `products` table, verified by the shop showing **Redmi 13C as "Out of stock"** because live stock is 0 |
| 4 | Backend routes for products and orders | Frontend reads products through the backend | **DONE (Session 13).** Both product routes now read the database |
| 5 | Checkout that saves orders, with delivery estimate | A guest order is saved with its items, cart clears | **DONE (Session 12), verified live.** Real orders in Supabase, stock decremented, both emails sent |
| 6 | Google login and role system | Sign in works, `/admin` blocks non-admins | **CODE DONE (Session 13), BLOCKED on the owner.** `backend/src/auth.js` verifies tokens and gates admin routes; `/signin` and `/auth/callback` pages exist. **Cannot work until Google is enabled in Supabase and redirect URLs are added** |
| 7 | Admin: products, stock, and feature fields | Admin can add, edit, and set stock for a phone | **CODE DONE (Session 14), needs an admin account to use.** `backend/src/admin.js` + `/admin/products` with create, edit, stock and full spec fields. Feature 26 warns about missing model features without blocking |
| 8 | Admin: orders and status updates | Admin can change an order's status | **IN PROGRESS (uncommitted).** Admin order list/detail UI and API additions are present. Build and end-to-end checks have not been completed; `/admin` is still stuck checking access locally. |
| 9 | Mailgun emails (customer and admin) | Customer gets an order email in under a minute | **DONE (Session 12), verified live.** Both emails fire from `POST /orders`; real Mailgun message IDs returned |
| 10 | Questionnaire and results pages connected to the model through `POST /recommend`, with session logging and feedback | A shopper answers 5 questions, sees ranked phones with reasons in under 3 seconds, and can add one to the cart | **MOSTLY DONE (Session 10).** Real ranked results live locally. Session logging + feedback buttons still missing |
| 11 | Admin model page, deployment checks, and real usability test | 2 of 3 real testers finish the flow from questionnaire to order unaided | Not started |

**Stage 1 note:** an earlier chat gave Stage 1 as `npx create-next-app@latest phone-shop` with TypeScript No, ESLint Yes, Tailwind Yes, `src/` Yes, App Router Yes. The architecture then changed to split hosting, so the Next.js app should only do the UI. Confirm the owner's progress, then continue.

**Suggested order for a beginner with little time:** build the shop stages and model steps M1 to M4 at the same time. A baseline model is enough to make Stage 10 work, and M5 can follow later.

---

## 14. Open questions (blocking or important)

1. ~~**Existing model.**~~ **ANSWERED (Session 4).** Python 3.12; a transparent weighted scorer plus a Random Forest distilled from it; 100% synthetic data (600 customers x 63 phones = 13,993 rows). Full audit in section 8.
2. ~~**Product data source.**~~ **ANSWERED (Session 4).** `model/legacy/data/phone_catalog_ng.csv`: 71 phones, 63 priced, 8 brands, naira prices with a source and verification date. See D30. The gap to close at M3 is missing specs (see audit change 10).
3. ~~**Labeled data.**~~ **ANSWERED (Session 4).** No real labeled data exists. The engine is the Random Forest per D34, but it was trained on the rule scorer's output, so it reflects no real buyer behaviour. M5 is when that changes.
4. **Hosting split.** Confirm frontend on Vercel and backend on Netlify.
5. **Currency and payments.** Confirm naira. Decide when to add Paystack.
6. ~~**Agent role.**~~ ANSWERED in Session 3: the agent writes the code (D25).
7. **Team status.** Is the team already formed, or still being recruited? The owner has not answered.
8. **Repo layout.** One repo with two folders, or separate repos for frontend, backend, and model service? (Suggested: one repo with `frontend`, `backend`, `model`.)
9. **Targets.** Confirm the model target (assumed: acceptable phone in top 3 for at least 80% of test personas).

Move answered questions into the Decision log.

---

## 15. Known risks

- **Model quality.** Without labeled data, a "prediction" is really a spec-match ranking. Say so honestly on the site (D24), and improve it with real feedback over time.
- **Catalog mismatch.** If the model's data and the shop's products differ, recommendations will point to phones that cannot be bought. Keep one source of truth for IDs.
- **Thin catalog.** With few phones, many answer combinations will give weak results. Plan the minimum catalog size with the owner.
- **Stale data.** Phone prices and stock change. Plan how prices and stock stay current.
- Simulated design findings may be wrong. Test with real people.
- Two hosts plus Supabase plus a model service means more config. Wrong URLs, missing environment variables, and CORS errors are the most common problems. Stage 1 exists to catch them early.
- A missing role check on one admin route can expose the admin. Review every admin route before launch.
- Cold starts on serverless functions and on free ML hosting can make the first request slow. Acceptable for v1, but watch the 3-second target.
- The owner is a beginner on a team project. Keep stages small.
- Google OAuth setup in Google Cloud Console is fiddly. Go through it slowly.

---

## 16. Session log

Add the newest entry at the bottom. Never edit or remove old entries. Copy this template.

```
### Session N: YYYY-MM-DD
**Agent/model:** (name)
**Goal of the session:**
**What was done:**
**Decisions made:** (also add to the Decision log)
**Problems or errors:**
**State at the end:** (exact stage, model step, and step)
**Next steps:**
```

### Session 1: 2026-10-01

**Agent/model:** Claude
**Goal of the session:** Plan the project and write the PRD.
**What was done:** Chose the stack. Gave Stage 1 setup instructions (create Next.js app). Wrote PRD v1.0 with design process and team workflow. Dropped the research phase at the owner's request. Simulated a kickoff meeting, wireframes, and a 3-person usability test, and merged all of it into the PRD. Added the admin side and split hosting (v1.1). Created this file.
**Decisions made:** D1 to D17 (see the Decision log).
**Problems or errors:** None. No code has been run.
**State at the end:** Planning finished. Stage 1 not started or not confirmed.
**Next steps:** Follow "Next action for the next agent" in section 3.

### Session 2: 2026-10-01

**Agent/model:** Claude
**Goal of the session:** Refocus the project around the model. The owner wants a shop where users click to use "our model", answer questions, and get a prediction of the best phone for their needs. The owner also said the model needs to be reworked.
**What was done:** Rewrote this file as PRD v1.2. Made the questionnaire and recommendations the main path (D18, D20, D21). Added the model workstream (section 8) with steps M1 to M8, a draft questionnaire, the feature list, the model service contract, and model rules. Added the `recommendation_sessions` table, feedback, logging, and an admin model page. Reworked Stage 10 and Stage 11. Added honest-wording and data-problem notes (D22, D24). Updated open questions and risks.
**Decisions made:** D18 to D24 (D13 replaced by D21).
**Problems or errors:** None. The owner has not yet shared the existing model, its data, or whether labeled data exists.
**State at the end:** Planning finished. No code run. Model audit (M1) not started.
**Next steps:** Follow "Next action for the next agent" in section 3. Start with the existing model details.

### Session 3: 2026-10-01

**Agent/model:** Cline
**Goal of the session:** Read the handoff, check the repo, ask the open "agent role" question, and create this file in the repo.
**What was done:** Checked `/home/dimeji/PhoneMatch`. It had no commits and no files, so no model code or shop code exists there. Asked the agent-role question. Created `AGENTS.md` from the owner's pasted text, with D25 added and open question 6 marked answered.
**Decisions made:** D25: the agent writes the code, the owner reviews and runs it.
**Problems or errors:** None. No code was run.
**State at the end:** Planning finished. Build not started. Model step M1 not started. Stage 1 not started. Repo is empty apart from this file.
**Next steps:** Follow "Next action for the next agent" in section 3. The existing model details block M1.

**Plan agreed this session (owner said: "you plan it, I will upload the model file and data soon"):**
1. **Waiting on the owner:** upload of the model file and the data. Put them in `/home/dimeji/PhoneMatch/model/legacy/`.
2. **Phase A (now, no upload needed): Stage 1 locally.** Create `frontend/` (Next.js, TypeScript No, ESLint Yes, Tailwind Yes, `src/` Yes, App Router Yes) and `backend/` (Express with a `GET /hello` route, wrapped for Netlify Functions). The frontend page shows the message from the backend. Check: run both locally and see the message in the browser. Deploy to Vercel and Netlify only after this works.
3. **Phase B (after upload): M1 audit.** The agent reads the model and data, fills in the audit box in section 8, and says what to keep and what to change. Check: the owner reads the audit and agrees.
4. **Phase C: M2 and M3.** Freeze the questionnaire and the feature map (answer to feature and weight table, stored in a config file). Build `model/data/phones.csv` with all required features. Check: no missing values.
5. **Phase D: M4 baseline recommender** in `model/` (Python): hard filters, weighted score, top 5, reasons from top contributing features. Check: run 10 personas and read the results together.
6. **Phase E: Stages 2 to 5** (product list, Supabase, backend routes, checkout) in order, one per session.
7. **Phase F: M6 and M7** (20 personas, 80% target, then FastAPI service), then Stage 10 (questionnaire and results wired to the model).
8. **Phase G: Stages 6 to 9 and 11** (auth and admin, emails, admin model page, real usability test with 3 people).
Rule: finish and confirm one phase before starting the next, except that the model track (B to D) and shop track (A, E) may run side by side.

### Session 4: 2026-10-01

**Agent/model:** Cline
**Goal of the session:** The owner uploaded the existing model and its data. Audit them (Phase B / step M1), decide what to keep, and get Stage 1 running locally.
**What was done:**
- Found the upload at the repo root: `src/` (7 Python files + `ml_model.joblib`, 42 MB) and `data/` (3 CSVs). Moved both into `model/legacy/` to match D26 and added `*.joblib` to `.gitignore`.
- Read every legacy file and wrote the **M1 audit** in section 8: framework, files, data sizes, inputs, outputs, target, evaluation, what to keep (10 points), what to change (10 points).
- Key finding: the Random Forest is **distilled from the rule-based scorer** (`build_training_data.py` says so in its own docstring), so it cannot beat the rules and encodes no real shopper behaviour. Recommendation: ship the transparent scorer as the v1 baseline.
- Checked the data: 600 synthetic customers; 71 catalog phones (63 with a verified price), 8 brands, NGN98,100 to NGN2,868,608; 13,993 training rows; **no real labeled data**.
- Ran the legacy rule-based recommender successfully with the repo venv (`/home/dimeji/venv`, pandas 3.0.3 + numpy 2.4.4). Verified sense: a NGN500k camera persona returns TECNO Camon 40 Pro 5G then two more Camons. Also found a weak spot — at NGN300k the same camera persona returns #1 with no camera reason.
- Updated sections 3, 4, 8, 13, 14 with the findings and added D30 to D33.
**Decisions made:** D30 (catalog source confirmed), D31 (ship the rule-based scorer, not the RF), D32 (legacy moved to `model/legacy/`, joblib git-ignored), D33 (M2 must map the questionnaire onto the legacy input shape).
**Problems or errors:**
- `frontend/npm install` is still running after ~20 minutes with no `node_modules` yet — the npm registry is very slow from this machine. This blocks the Stage 1 browser check, not the code.
- `scikit-learn` was missing from the venv (`/home/dimeji/venv` had pandas + numpy only). Installed scikit-learn + joblib in the background and re-ran `train_model.py`: **MAE 1.19, R^2 0.969**, now recorded in the audit box. The refit also regenerated `ml_model.joblib` (git-ignored).
**State at the end:** M1 DONE. M2 not started. Stage 1 backend verified locally (`/hello`, `/health`); frontend written but not yet rendered in a browser. Nothing committed to git.
**Next steps:** 1) confirm `npm install` finished, then run both servers and check the message in the browser. 2) Deploy Stage 1 to Vercel + Netlify. 3) Start M2: freeze the questionnaire and write the answer-to-feature-and-weight config.
### Session 5: 2026-10-01

**Agent/model:** Cline
**Goal of the session:** The owner rejected the Session 4 recommendation to ship the rule-based scorer and chose the Random Forest. Record the decision properly, measure the real cost of the forest, and make sure the plan and the docs match the decision.
**What was done:**
- Measured the forest instead of guessing: **0.23-0.45s per prediction, 5.5s cold model load, 41 MB artifact**, catalog load 0.9s. Fast enough for the 3-second target, but only with a warm process.
- Ran a wider head-to-head (4 personas) of rules vs forest, because the Session 4 evidence (3 personas, "identical every time") was too small to support a decision. Result: **2/4 identical; the other 2 differed only by two adjacent phones swapping rank, with an identical set.** So the forest reproduces the rule ranking and adds regression noise. Corrected the audit box — the old claim was too strong.
- Wrote the owner's decision into the log as **D34**, marked **D31 replaced**, and rewrote the "What to change" item 1 so the file no longer says "DO NOT ship the Random Forest" against the owner's decision. The original recommendation is kept inline as the record of what was analysed and declined.
- Added **D35**: 41 MB + 5.5s cold load means the model service must be a warm persistent container (M7 on Render/Railway), NOT a Netlify serverless function. This is now a hard architectural constraint, not a preference.
- Reworded M4 and M5, since the forest is now the recommender rather than a future upgrade.
- Added a warning to the model rules: **a Random Forest regresses a score and cannot enforce a constraint.** It has no concept of stock, active, or budget_min, so the hard filters must be applied to the candidate list BEFORE the forest scores, never trusted from its output.
- **Then completed M2** (the owner said "ok" to starting it while npm was still running):
  - Wrote `model/config/questionnaire_v1.json`, the frozen 5-question questionnaire plus the answer-to-feature map, hard filters, and the reason/rating thresholds. It is the single source of truth the team can tune without touching code, as the model rules require.
  - Wrote `model/src/questionnaire_mapper.py` to apply that config: `map_answers` (answers to the 7 customer keys), `apply_hard_filters` (price/storage/stock/active BEFORE the forest), `reorder_for_lowest_price`, and `questionnaire_for_frontend` (strips internal notes before sending options to the UI).
  - Grounded the budget bands and storage steps in the REAL catalog, not invented numbers: 63 priced phones, median NGN 556,000, and the only four storage values present are 64/128/256/512, so light/medium/heavy map exactly onto 64/128/256.
  - **Found and fixed a real gap by testing, not by reading.** With a NGN 500k-1m budget and top_priority "lowest price", the forest returned a NGN 556,000 Infinix at #1 while a NGN 98,100 Redmi 13C was sitting in the candidate set. The 75% price cap was not enough on its own, because the forest ranks by match_score, not price. Added `reorder_for_lowest_price` (sorts cheapest-first, price cap and storage floor still enforced) and re-tested: picks are now NGN 227,700 / 370,000 / 556,000, correctly ascending, with the non-price path verified untouched.
  - Two questionnaire answers have NO honest model input and are documented rather than faked: "Screen" (no screen feature exists, folds into performance) and "Lowest price" (budget weight is fixed at 0.30, handled by the cap + re-sort). Both are flagged in the config `why` fields and the M2 box. M3 should give screen a real feature if the team wants it.
  - Verification: 6 personas run end to end through hard filters then the forest, no over-budget and no under-storage result in any of them, and **all 18 budget x storage combinations return at least one candidate** (thinnest is 1 phone: heavy storage under NGN 150,000 — a real thin-catalog risk for the M3 expansion). Bad input is rejected loudly via MappingError, and the frontend payload is confirmed not to leak internal `__price__` / `alias_of` values.
**Decisions made:** D34 (forest is the v1 engine, confirmed by owner), D35 (warm persistent model service required).
**Problems or errors:**
- `npm install` for the frontend is STILL not finished. Root cause found this session: DNS for `registry.npmjs.org` returns only IPv6 addresses and this machine's IPv6 is broken (`curl -6` gives http=000), so Node was hanging on dead IPv6. Worked around with `NODE_OPTIONS=--dns-result-order=ipv4first`, which produced real progress (~200 KB/s). A Next.js install is ~200 MB, so 20-40 minutes on this connection. PyPI is fast; npm specifically is the bottleneck.
**State at the end:** M1 DONE and the engine decision is CLOSED (D34). **M2 DONE** — questionnaire frozen as config, mapper written and tested against the real catalog and the real forest. M3 not started. Stage 1 backend verified locally; frontend code written but not yet rendered in a browser. Nothing committed to git.
**Next steps:** 1) **M4**: build the shop recommender in `model/src/` — hard filters (price, storage, stock, active) THEN the Random Forest ranks, then top 5 with reason lines and ratings from `scoring.py`. Check: run 10 personas and read the results together. 2) Decide whether "screen" becomes a real model feature (the data is now ready for it). 3) Expand the thin bands: 2m+ has only 2 phones, heavy storage under NGN150k has only 1. 4) Finish the Stage 1 browser check when `npm install` completes, then deploy to Vercel + Netlify. 5) At M7, build the FastAPI service as a warm container, not a serverless function (D35).

### Session 6: 2026-10-01

**Agent/model:** Cline
**Goal of the session:** M3 — build `model/data/phones.csv`, the launch catalog with a stable `product_id` and every model feature filled in.
**What was done:**
- Measured the gaps before fixing them. Of 71 scraped rows, **8 have no verified price** and are dropped (unbuyable — a price cap is meaningless without a price). Of the remaining 63, **25 have at least one missing spec**; 38 are fully measured.
- Wrote `model/src/build_phones_csv.py`, re-runnable, which regenerates the CSV from the legacy scrape. Output: **63 rows, 30 columns, zero missing values, unique ids.**
- **Caught an id collision that would have broken the shop.** A plain slug strips `+`, so `Galaxy S26` and `Galaxy S26+` both produced `samsung-galaxy-s26`; same for `S25/S25+`, `Spark 40 Pro/Pro+`, `itel A200/A200+` — 4 collisions. Fixed by mapping `+` to `plus` before slugging, with a stable numeric suffix as a second guard. All 63 ids verified to join back to the legacy catalog: **0 unmatched.** This closes the catalog-mismatch risk from section 15 on the model side.
- **Imputed, but never silently.** Each missing spec is filled from the **median of the same brand within the same price tier**, not a global median, because a budget phone must not inherit a flagship battery. Every fill is recorded in `imputed_fields` and a per-column `*_imputed` flag, so an imputed battery is visibly a guessed battery that admin can fix at Stage 7. `processor` is text, so it takes the mode, never a median.
- **Two bugs the build checks caught, both of which would have shipped quietly:** (1) an `IndexError` because rows were filtered before a positional list was built, so position and index label disagreed; (2) `imputed_fields=""` written as an empty string is read back by pandas as **NaN** — "zero missing values" was true at write time and false on reload. Fixed with a `none` sentinel, then re-verified by reloading the file independently.
- Added `stock` (default 10) and `active` (default True) — columns the legacy catalog never had, needed so `apply_hard_filters` can enforce them. Verified they bite: set all stock to 0, or all inactive, and candidates drop to 0.
- Ran the real chain end to end (answers → mapper → hard filters → Random Forest). A NGN300k–500k camera persona returns Camon 40 Pro 5G (NGN400,000), Camon 50 Pro 4G, Camon 50 4G. 26 candidates survive the filters.
- Documented the catalog's real shape: 0–150k 14, 150k–300k 9, 300k–500k 8, 500k–1m 16, 1m–2m 14, **2m+ only 2**. Heavy storage under NGN150k has **one** candidate (Redmi 13C). Measured limit, not a bug, and now the expansion target.
**Decisions made:** none new. D28's "create phones.csv from scratch" stays superseded by D30; this session delivered the dataset D30 implied.
**Problems or errors:**
- The two build bugs above, both caught by the script's own checks rather than by inspection.
- `npm install` is still not finished. npm remains the bottleneck; PyPI was fast, npm is not.
**State at the end:** M1, M2, M3 all DONE. M4 not started. Stage 1 backend verified locally; frontend written but still not rendered in a browser. Nothing committed to git.
### Session 7: 2026-10-01

**Agent/model:** Cline
**Goal of the session:** Finish M4 (the shop recommender) and get the Stage 1 browser check done, which had been blocked on npm for three sessions.
**What was done:**
- **M4 DONE.** Wrote `model/src/shop_recommender.py`. One entry point `recommend(answers)` that runs map answers -> HARD FILTERS -> Random Forest -> reasons and ratings from `scoring.py`. Step 2 before step 3 is deliberate and commented in the file: the forest regresses a score and cannot enforce budget, stock or active, so those are applied to the candidate list first (D34).
- Reason lines now lead with the shopper's stated use, which fixes audit change 8: a camera persona used to get a camera pick whose reasons were only "fits your budget" and "strong battery". Also, a pick with imputed specs now says so on the results page, so no guessed number is shown as fact (D24).
- Wrote `model/src/test_personas.py` with 10 personas covering every budget band and every storage step, plus direct tests that all-stock-zero and all-inactive both yield 0 candidates. It exits non-zero on any hard-rule breach, so it can run in CI later.
- **10/10 personas pass, all hard rules held.** Sample: NGN300k–500k camera returns Camon 40 Pro 5G, Camon 50 Pro 4G, Camon 50 4G, all "camera Excellent". Cheapest-band student gets Redmi 13C at NGN98,100 with an honest "only a few phones fit" message.
- Noted three measured weak spots rather than hiding them: a flagship budget can legitimately return the NGN98,100 Redmi when the shopper asks for lowest price; the flagship camera persona's #1 is a folding phone rated camera Fair; and the cheapest band with light storage has only 3 candidates, so the results page must handle fewer than 5.
- **Stage 1 frontend check DONE, after three sessions of being blocked.** The npm install had actually FAILED with a network error (empty `node_modules`). Restarted it with `--prefer-offline` against the now-warm cache (882 MB): **360 packages in 3 minutes.** Root cause of all the pain was the broken IPv6 plus a dead connection, not the project.
- Verified the full Stage 1 chain: Next.js 16.3.8 serves the page on :3000, the backend answers `/hello` on :4000, and **CORS returns `Access-Control-Allow-Origin: http://localhost:3000`**, so the browser is allowed to make the call. The message is client-rendered, so `curl` on the HTML does not show it by design; confirmed the request path works instead.
**Decisions made:** none new. D34 (forest ships) and D35 (warm container required) both already recorded; M4 is the first code that actually implements D34's filter-then-rank rule.
**Problems or errors:**
- `npm install` had silently died with a network error in an earlier session; I had reported it as "still running". Corrected by checking the log rather than trusting the process list.
- Two authoring errors while writing M4: a helper insertion split `_why()` in half and left a stray `_budget_band` return after `recommend()`. Caught by running the file, fixed, and all four modules now compile clean.
- The first persona test run failed because I typed budget and storage labels by hand. The frozen config's labels contain double spaces and display wording ("Light  (64GB is enough)"), so the test now derives every label from the config instead of hardcoding strings that could drift.
**State at the end:** M1, M2, M3, M4 DONE. Stage 1 built and verified locally on both sides. Still not deployed, still not committed to git.
**Next steps:** 1) Deploy Stage 1 to Vercel + Netlify. 2) **Commit everything to git** — four sessions of work is uncommitted. 3) M5, once there is real labeled data; until then the forest can only reproduce the rule scorer (D34). 4) M6 with 20+ personas. 5) M7 as a FastAPI warm container, never a serverless function (D35).
### Session 8: 2026-10-01

**Agent/model:** Cline
**Goal of the session:** Commit the four sessions of uncommitted work, and prove the commit is actually complete by rebuilding from a clean clone.
**What was done:**
- **Committed 47 files to `main`** (commit `8ba5ef2`). This was the first commit in the repo; four sessions of work existed only on disk. Verified before committing: `node_modules`, `.env.local`, and the 42MB `ml_model.joblib` were all correctly excluded, and a grep for keys/tokens/secrets across every staged file found only comments and npm integrity hashes.
- Caught that `__pycache__` bytecode would have been committed (12 `.pyc` files) — added `__pycache__/`, `*.py[cod]`, and venv patterns to `.gitignore`, then deleted the existing bytecode.
- **Proved the commit is complete by cloning it fresh** (`git clone . /tmp/clonecheck`) rather than trusting that it looked fine in place. This found a real gap: `test_personas.py` failed immediately on a clean clone with `FileNotFoundError: ml_model.joblib`, because the artifact is git-ignored but nothing documented that it must be rebuilt first. A new contributor would have hit this on day one.
- Confirmed the documented rebuild path actually works: `train_model.py` reads the **committed** `training_data.csv`, needs no network, and regenerates the 41MB artifact. Then re-ran the persona suite from the clean clone: **10/10 pass, exit 0.**
- Documented the post-clone rebuild step in `model/legacy/README.md`, and corrected that file's stale claim that "v1 of the shop uses the transparent scorer" — untrue since D34. It now states the forest ships, that `scoring.py` is still required for reasons and ratings, and that the quality ceiling stays the rule scorer.
**Decisions made:** none new. No new decision was needed; this session only committed and hardened what already existed.
**Problems or errors:**
- `__pycache__` staged by accident — caught during the pre-commit inspection, fixed in `.gitignore`, and the bytecode deleted before committing.
- The clean-clone failure above. Root cause: an unstated precondition, not a missing file. Fixed by documenting it rather than by committing a 42MB binary.
**State at the end:** M1, M2, M3, M4 DONE and **committed**. Stage 1 built and verified locally, also committed, still not deployed. Working tree clean, nothing pushed to GitHub yet.
**Next steps:**
1) Push to GitHub (`git push -u origin main`) — the owner has a remote configured and it is still unpushed.
2) Deploy Stage 1 to Vercel + Netlify (D8/D9 assumed; confirm the split, open question 4).
3) M5, which is blocked on something real: there is still no labeled data, so the forest can only reproduce the rule scorer (D34). M5 needs team-labeled personas, then real feedback and orders, before it can improve on the rules at all.
4) M6 with 20+ personas and an agreed acceptable-answer set.
### Session 9: 2026-10-01

**Agent/model:** Cline
**Goal of the session:** Build Stage 2 (product list, price filter, cart) against the real model catalog, then build the questionnaire screens on top of it.
**What was done:**
- **Stage 2 DONE and verified live.** Backend `GET /products` and `/products/:id` now read `model/data/phones.csv` — the same file the model scores — so the shop and the model cannot show different phones. Frontend got `/phones` (server-rendered list), `/phones/[id]` (detail with specs), `/cart`, and a real home page (the old Stage 1 hello-world page was replaced).
- **Price filter runs on the SERVER via URL params**, so it is shareable, bookmarkable and works with the back button. Verified: the 150k–300k band returns 9 phones, matching the backend's own count.
- **Cart is in local storage** (no database until Stage 3), capped at stock, and shows the delivery estimate IN the cart as AGENTS.md section 10 requires.
- **Questionnaire screens built** (`/find`, `/results`). The five questions are NOT hardcoded in the UI: the backend reads the frozen `model/config/questionnaire_v1.json` and strips the internal `why`/`alias_of` notes, so the team can reword a question without touching code. Verified zero internal keys reach the browser. One question per screen, progress bar with ARIA, Back button, Skip on the optional question only.
- Committed and pushed: `89c0af3` (Stage 2) and `98582a1` (questionnaire).
**Decisions made:** none new. No decision was required; D21 (five preset questions) and D24 (honest wording) were already recorded and this session simply follows them.
**Problems or errors:**
- **Every page returned 500.** `CartProvider` is a NAMED export (`export function CartProvider`) but `layout.js` imported it as a default, giving `undefined`; React reported only "Element type is invalid", which points nowhere near the cause. Fixed to a braced import.
- The home page was still the Stage 1 client-side hello-world test. Rewritten as a server-rendered shop home.
- Two bad imports written by me and caught before running: `formatNaira` imported from `lib/api` instead of `lib/format`, and a `formatPrice` export that does not exist.
- A `next dev` server started inside a tool call was killed with the shell (SIGTERM). Started it via `setsid` + a wrapper script so it survives.
- Two "missing" greps were my own fault, not code bugs: Next.js SSR splits JSX text nodes with HTML comments, so `Question 1 of 5` appears as `Question <!-- -->1<!-- --> of <!-- -->5`. Confirmed the DOM is correct.
**State at the end:** M1–M4 DONE. Stage 1 and Stage 2 DONE and verified live locally. Questionnaire screens built and working. All committed and pushed. **Nothing deployed.**
**Next steps:**
1) **Stage 3 (Supabase)** — needs the owner's Supabase account. This is the first stage that requires a cloud account (D27).
2) Deploy Stage 1+2 to Vercel + Netlify (D9 split still assumed; open question 4).
3) **M7 then Stage 10** to make the questionnaire return real rankings. `/results` deliberately shows an honest "not available yet" message and `POST /recommend` returns 501 — only those need to change.
4) M5 is blocked on real labeled data; M6 needs 20+ personas.

### Session 10: 2026-10-01

**Agent/model:** Cline
**Goal of the session:** Make the questionnaire return REAL rankings instead of the honest placeholder. This is M7 (the model service) plus the main part of Stage 10.
**What was done:**
- **M7 service written and running: `model/service/main.py`.** FastAPI with `/health`, `/version` and `POST /recommend`, wrapping the existing `shop_recommender.recommend()`. Deliberately in-process (D35): the 41 MB artifact and the 5.5 s cold load mean this must be a warm container, never a Netlify function.
- **Backend `POST /recommend`** proxies to the model service and returns ranked picks with reasons, ratings and specs. Verified the full chain model → backend → browser.
- **`/results` rewritten** (`frontend/src/app/results/page.jsx` + `frontend/src/components/ResultList.jsx`). It now renders real ranked phones: rank, naira price, reason lines, Excellent/Good/Fair ratings, and working **Add to cart**, **View details** and **Change my answers**. The honest "not available yet" placeholder and the 501 are gone.
- **One real bug caught by testing the actual payload.** The mapper rejected the exact label strings the frontend sends (`Medium  (128GB is enough)` vs the config's `Medium (128GB)` — a double space and different wording). Fixed in `model/src/questionnaire_mapper.py` so it accepts what the UI actually produces. Found only because I sent a hand-typed payload and it was rejected loudly instead of silently mis-ranking.
- Verified end to end: camera persona NGN300k–500k → Camon 40 Pro 5G (#1, "Strong camera for your needs"), Camon 50 Pro 4G, Camon 50 4G. Prices render as ₦400,000 etc. All 4 other pages still 200. **10/10 personas still pass.** The thin-catalog path still shows "only a few phones fit".
- Committed and pushed: `367e9c7`.
**Decisions made:** none new. D34 (forest ships) and D35 (warm container) already covered this; the service was built to those constraints.
**Problems or errors:**
- Two of my own test payloads were wrong (I hand-typed questionnaire labels). The service rejected them with a precise message listing the valid labels — good behaviour, but it cost me a cycle. The frontend sends the config's real labels, so this is not a product bug.
- Two greps I ran to "prove prices were missing" and "prove ratings were missing" were both wrong: prices use the ₦ symbol not "NGN", and Next.js splits JSX text with HTML comments. The DOM was correct both times. This is the third time this exact false alarm has happened — noted so the next session greps for the rendered form, not the source form.
**State at the end:** M1–M4 and M7 DONE. Stage 1, 2 and most of 10 DONE, all verified live locally and committed (`367e9c7`). **Still not deployed.**
**Next steps:**
1) **Stage 3 (Supabase)** — needs the owner's Supabase account; it is the first stage requiring cloud credentials (D27). It unlocks session logging, the feedback buttons, orders and checkout, which are the remaining parts of Stage 10 and all of Stages 5/6.
2) Deploy to Vercel + Netlify (+ Render/Railway for the model service) — confirm the D9 split first (open question 4).
3) **Remaining Stage 10 gaps:** `recommendation_sessions` logging and the "Was this helpful?" feedback buttons (feature 11). Both need the database, so they belong with Stage 3.
4) M5 remains blocked on real labeled data; M6 needs 20+ personas.


**Session 10b fix — the questionnaire dead end (found by the owner, not by me).**
The owner reported an error on the last question. Root cause was one line in
`frontend/src/components/Questionnaire.jsx`: the action button was rendered as
`{!isLast && !selected && ...}`, so on the LAST question it could NEVER appear.
On questions 1-4 picking an option auto-advances, so the missing button was
invisible. On question 5 (brand) there is nowhere to advance to, so selecting a
brand did nothing and the only way out was "Skip", which DELETED the answer just
given. Replaced with an explicit `showAction` variable: `!selected` on questions
1-4, `selected` on the last. The last button now reads "See my phones".
Verified by replicating the component's state machine in Node and walking both
paths (pick a brand / skip the brand) — both now reach /results with the brand
answer correctly kept or correctly absent. 10/10 personas still pass.
Lesson recorded: this is the second bug that only a human clicking the real UI
could find, and the third that a build passing did NOT mean the flow worked.

### Session 11: 2026-10-01

**Agent/model:** Cline
**Goal of the session:** Add the brand-preference fix that was half-finished, then
wire Mailgun for Stage 9 using the credentials the owner supplied.
**What was done:**
- **Finished the brand-preference work.** The forest silently ignores
  `brand_preference` (it is not in `MODEL_COLUMNS`), so picking "itel" returned
  mixed brands. Added it as a CONFIG-DRIVEN preference in
  `questionnaire_v1.json` + `apply_hard_filters`, not a hard filter, because a
  strict filter can return zero results. Verified: asking for itel now returns
  only itel (3 candidates); asking for Apple iPhone at that budget returns the
  honest message "we have none in that price and storage range, so we have shown
  you the closest matches from other brands". Added a brand regression test.
- **Stage 9 email module: `backend/src/email.js`.** Order confirmation (plain text
  + escaped HTML), new-order alert to admin (feature 23), status update
  (feature 22). Installed `form-data@4.0.1` and `mailgun.js@11.1.0` as the owner
  specified. **Live send verified against the real Mailgun API**, message id
  returned.
- **Two real bugs found by testing, not reading:**
  1. **`dotenv` was never loaded by the server** — only by `seed_products.js`. The
     running backend therefore had NO Supabase and NO Mailgun keys, and would
     have reported "email not configured" forever while looking like unfinished
     work. Fixed at both entry points (`server.js`, `netlify/functions/api.js`,
     the latter with `override: false` so a stray local .env can never beat a real
     deployed variable). Startup now prints what is configured.
  2. **`S_MEDIUM` vs `S_MED` NameError** in the brand persona test I added last
     session — the persona suite was crashing on exit, so 10/10 could not be
     confirmed. Fixed; suite passes again, exit 0.
- Added `backend/.env.example` documenting every variable with no secrets in it.
- Committed `ee11ba2`. Verified: the Mailgun private key is in **no tracked
  file**, has **never been committed** (`git log --all -p` returns 0 hits), and
  `scripts/check-for-secrets.sh` passes. `.env` is `600` and git-ignored.
**Problems or errors:**
- The owner's Mailgun key and the Supabase DB password are both now in the chat
  history and must be **rotated before launch**. Both are correctly stored in
  `backend/.env` and absent from git, but chat logs are not something we control.
- `setsid nohup ... &` inside a tool call kept getting SIGTERM'd with the shell.
  `nohup setsid node ... &` + `disown` survives. Worth remembering.
**State at the end:** M1-M4 and M7 done. Stages 1, 2, 10 done. Stage 9's email
MODULE is done and verified live, but nothing calls it yet: **`POST /orders` does
not exist (that is Stage 5)**. Stage 3 (Supabase tables seeded, product list from
the DB) still needs the owner to run the SQL. Nothing deployed.
**Next steps:**
1) **Stage 5 (checkout + `POST /orders`)** is now the blocker for Stage 9 — an
   email module with no order route cannot be proven end to end.
2) Stage 3: owner runs `backend/src/db/RUN_THIS_IN_SUPABASE.sql`, then seed.
3) Rotate both leaked secrets before any deployment.
4) Deploy to Vercel + Netlify; model service to Render/Railway (D35, warm
   container, never serverless).

### Session 12: 2026-10-01

**Agent/model:** Cline
**Goal of the session:** Stage 5 (checkout that saves orders). Stage 9's email
module had been written in Session 11 but nothing called it, because
`POST /orders` did not exist, so the email flow could not be proven end to end.
**What was done:**
- **Connected Supabase for real.** Found the Supabase **pooler on port 6543**
  works from this machine (direct 5432 is blocked). Wrote
  `backend/src/db/apply_schema.js`, which applies `schema.sql` over it, so the
  owner no longer has to paste SQL into the dashboard. All tables created, RLS
  enabled, 63 products seeded and IDs verified against `phones.csv`.
- **Stage 5 DONE, verified with real orders.** `backend/src/orders.js` (346
  lines) builds and saves orders; `POST /orders` and `GET /orders/:id` are
  live. Built `/checkout` (guest checkout, no account needed, Nigerian state
  picker so a misspelled state cannot become a failed delivery) and
  `/order/[id]` confirmation.
- **Three security decisions that are deliberate, not incidental:**
  1. The client sends only `product_id` and `quantity`. Prices are re-read from
     the database server-side, so a tampered cart cannot change what is charged.
     VERIFIED by sending `price_ngn: 1` and a huge quantity: the real price won.
  2. Stock is decremented **inside one database transaction**, so two shoppers
     cannot both buy the last unit.
  3. **An email failure does NOT roll back a real order.** Losing a paid order
     because Mailgun was briefly down would be far worse than a late email.
     The order is saved first; the email is attempted and logged after.
- Fixed the "silent success" trap from Session 11: email outcomes are now
  visible in the backend log (`order confirmation sent to ... <message-id>`),
  and a sandbox-blocked recipient is logged with a reason instead of quietly
  disappearing.
- Rewrote `API_CONTRACT.md` (177 lines). It was describing Stage 1 only while 8
  routes were actually built. Also added `GET /model/version`, which existed in
  code but was missing from the contract.
**Decisions made:** none new. D12 (guest checkout) and D16 (simulated payments)
already covered this.
**Problems or errors:**
- **My own test payloads were wrong twice.** I hand-wrote `{"customer":{...}}`
  and got `Please enter your email address.` The real shape is flat with
  `full_name` and `address_line`. The validation was right and my test was
  wrong — third time this session pattern has cost a cycle, so it is now a
  standing note: read the handler's expected shape before curling it.
- Found 54 `undefined` strings on the confirmation page and investigated before
  reporting: **all are inside Next.js's internal RSC payload**, not visible
  text. The rendered page shows the correct order reference and all three money
  rows. No bug.
- The confirmation page previously rendered an em-dash for every total, because
  `POST /orders` returned `subtotal/total` while `GET /orders/:id` returned
  differently named fields. Both now share one shape on purpose.
**State at the end:** Stages 1, 2, 5, 9 DONE and Stage 10 mostly done, all
verified live locally against the real Supabase project and the real Mailgun
API. Stages 3 and 4 are partly done: the database is real, but **`GET /products`
still reads `model/data/phones.csv`, so the product list shows stale stock.**
Committed `2d7c3bb`. Personas 10/10, secret scan passes, all pages 200.
**Next steps:**
1) **Finish Stage 3 properly:** switch `GET /products` to read the `products`
   table so stock shown in the shop matches stock that orders decrement.
2) **Stage 6 (Google login + roles)** — then `/admin` and the admin routes.
3) Stage 10's remaining gaps: `recommendation_sessions` logging and the
   "Was this helpful?" feedback buttons (feature 11). Both need the database
   and are now unblocked.
4) Rotate the Supabase DB password and the Mailgun private key before any
   deployment — both are in this chat's history.
5) Deploy to Vercel + Netlify, model service to Render/Railway (D35, warm
   container, never serverless). Confirm the D9 hosting split first (open
   question 4).

### Session 13: 2026-10-01

**Agent/model:** Cline
**Goal of the session:** Finish Stage 3 (product list reads the database, not the
CSV), then build Stage 6 (Google sign-in and roles). The owner interrupted to
confirm sign-in was not integrated, so Stage 6 was prioritised.
**What was done:**

- **Stage 3 DONE, and the bug it fixes was already live.** Before changing
  anything, I measured the database: real orders from Session 12 had driven
  **Redmi 13C to stock 0** and **Camon 40 Pro 5G to 6**, while the product list
  was still reading the CSV's flat 10. The shop would have offered a sold-out
  phone for "Add to cart". `GET /products` and `GET /products/:id` now read the
  `products` table; filters run in SQL rather than in memory, and the brand list
  comes from the database so the filter UI cannot offer a brand that returns
  nothing. Verified in the browser: Redmi 13C renders "Out of stock" with no Add
  button, and `in_stock=true` under NGN150k returns 0 phones.
- **Fixed the deeper bug behind it.** Switching the shop to the database created
  a NEW inconsistency: the model still read stock from the CSV, so it would keep
  recommending the sold-out Redmi. The backend now sends the currently sellable
  ids as `available_ids` and the model applies them as an **intersection**. This
  is the security-sensitive part, so it was tested rather than assumed: a
  fabricated id yields **0 rows** (cannot smuggle a phone in), `None` means
  "unknown" and leaves the catalog untouched, an empty list means "nothing
  sellable", and excluding the Redmi removes it from real recommendations.
- **Stage 6 code DONE.** `backend/src/auth.js` verifies the Supabase token with
  Supabase and reads the role from `profiles` — never from the request body,
  never from the JWT claims. `requireAdmin` is the gate Stages 7/8 will copy.
  `/signin` and `/auth/callback` pages, an `AuthProvider`, and a header that
  shows the signed-in state. `POST /orders` records `user_id` from the verified
  token so order history can work later.
- **Refactored the duplicated Supabase client** into `supabaseClient.js`, so the
  key-name check (the 2025 `secret`/`service_role` rename) lives in one place
  instead of two that could drift.

**Decisions made:** D36 (database owns price and stock, CSV owns model specs),
D37 (`available_ids` as intersection, replacing the Session 7 refusal to accept
candidate ids), D38 (identity from the verified token and `profiles.role` only;
verification uses the publishable key; first admin promoted by hand).
**Problems or errors:**
- **A syntax error I introduced in `products.js`.** I inserted code by line
  number into a file I had just written in two chunks, and the insert landed
  *inside* `toProduct()`, splitting it in half while leaving its tail stranded
  after `module.exports`. Caught by `node --check` on every file, which is now
  part of the routine. Lesson: after a chunked file write, check the seams before
  moving on.
- **`fix_descriptions.js` silently repaired nothing on the first run** (0 of 63)
  and I nearly trusted it. Cause: the matcher rebuilt the "old" description
  using `catalog.js`, which I had *already fixed to round* — so it compared the
  stored float text against already-corrected text and never matched. It had to
  re-read the raw unrounded CSV rows. This is exactly the "looks like it worked,
  did nothing" failure mode called out in section 15.
- **A second near-miss in the same script:** the update wrote
  `phone.description`, but `phone` was a raw CSV row with no such property, which
  would have set the column to **null and blanked all 63 product descriptions**.
  Caught by reading the write path before running it. Final result: 63 repaired,
  0 null, 0 floats, and a second run is a clean no-op.
- **I was editing against a stale server twice.** `pkill` in the same command
  killed my own shell, and once an old process kept port 4000 so my new server
  died with EADDRINUSE while the OLD code answered my tests. I briefly thought
  my 400-status-code fix had not worked when it had. Must check
  `ss -lptn 'sport = :4000'` and confirm the new PID before trusting a test.
- Two test failures were **my test's fault, not the code's**: an unencoded space
  in a `?search=` URL, and a `/products` call that needed a longer timeout.
- Playwright's browser download timed out twice (the same flaky network that
  made npm slow in Session 5). Verified the rendered pages via the
  server-rendered HTML instead, which was sufficient for these checks.
**State at the end:** Stages 1, 2, 3, 4, 5, 9 done. **Stage 6 code is complete
but CANNOT WORK until the owner enables Google in Supabase and adds the redirect
URLs** — two dashboard steps, no code. Committed `0ca3278` (Stage 3), `b330bf4`
(Stage 6), `a6ad054` (carried-over styling). Personas still 10/10. `next build`
passes with both new pages registered, and the secret scan passes. Nothing
deployed, nothing pushed to GitHub yet.
**Next steps:**
1. **Owner:** enable the Google provider in Supabase and add
   `http://localhost:3000/auth/callback` (plus the Vercel URLs) to the redirect
   list, then add `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to `frontend/.env.local`. Then sign in
   once and set `profiles.role = 'admin'` for that user.
2. **Stage 7 and Stage 8** (admin products/stock, admin orders/status), now
   unblocked. `GET /admin/ping` is the reference route for the role gate.
3. Stage 10's remaining gaps: `recommendation_sessions` logging and the
   "Was this helpful?" feedback buttons.
4. Rotate the Supabase DB password and the Mailgun private key before deploying.

### Session 13b: 2026-10-01

**Agent/model:** Cline
**Goal of the session:** The owner asked for a way to sign up and sign in with a
name, email and password instead of Google, and asked whether any API key was
needed. Build it, and prove the security posture rather than assume it.
**What was done:**

- **Answered the key question first: no new key is needed.** Supabase handles
  email/password entirely from the publishable key, which the agent added to
  `frontend/.env.local` (public by design, git-ignored, verified ignored).
- Built `/signup`, `/forgot-password`, `/reset-password`, and an email form on
  `/signin`. Google and email are EQUAL choices with an "or" divider, not a
  primary and a fallback (D39).
- **Privacy choices made deliberately, and both are commented in the code:**
  `/forgot-password` shows the SAME message whether or not the address exists
  (otherwise it is an address-enumeration tool), and sign-in never distinguishes
  "no such account" from "wrong password". Signup DOES surface Supabase's own
  wording, because there the person already knows the address and hiding it only
  makes "I forgot I already signed up" unfixable.
- Signup does **not** auto-sign-in. That is not an oversight: email confirmation
  is the control that makes signup safe, so signing in early would be a lie.

**Decisions made:** D39 (Google and email are equal paths; email confirmation is
therefore a locked setting), D40 (the publishable key is public, only
`sb_secret_` is a leak).
**Problems or errors:**

- **Proved the spam-account risk instead of describing it.** A signup with only
  the public key returned `200` and created a real user. Then signing in as that
  user returned `email_not_confirmed`, and `email_confirmed_at` was null — so a
  spammer CAN create rows but CANNOT sign in, place orders, or reach admin. Test
  user deleted; 0 users before and after; the 10 real orders untouched.
- **BLOCKER FOUND AND MEASURED: signup returns `429
  over_email_send_rate_limit`.** Supabase's free mailer allows ~2 emails/hour and
  is already exhausted, so email signup, confirmation and password reset will all
  fail until a real SMTP provider is configured. Google is unaffected because it
  sends no email.
- **AND THE OBVIOUS FIX IS BLOCKED — Mailgun CANNOT do it, proven over SMTP.**
  `backend/.env` has `MAILGUN_DOMAIN=sandboxbb3ee46c055d406bb6f5162dc99a206d
  .mailgun.org` and the domains API reports **`type: sandbox`**, `state: active`.
  Measured directly against `smtp.mailgun.org:587`:
    - port 587 reachable, banner `220 Mailgun Influx ready`, EHLO ok
    - `AUTH LOGIN` as `postmaster@<sandbox domain>` → **`535 Authentication failed`**
    - the SAME key succeeds on `api.mailgun.net` (HTTP 200), and the account has
      **0 non-sandbox domains**, so the key is valid and the rejection is the
      sandbox domain itself
  A Mailgun sandbox domain is for API testing only: it sends solely to whitelisted
  test addresses and cannot authenticate over SMTP at all. So it is **not** a valid
  SMTP provider for Supabase. The owner must add a real domain in Mailgun (free on
  the $0/month plan, needs a domain with DNS records) or use a different provider
  (Resend, Brevo and Mailjet all have free tiers). **Do not tell the owner that
  Mailgun fixes this until a real domain exists and SMTP auth has been re-tested.**
  This corrects the earlier assumption in this session that Mailgun could simply be
  pointed at by Supabase.
- **Two real bugs the build caught, both from line-number inserts into
  half-written files leaving orphan code behind.** (1) `Too many re-renders` on
  `/reset-password` and `/signup`: `onAuthStateChange` re-emits a NEW session
  object, so `setSession(next)` always looked like a change and re-rendered
  forever; fixed by comparing the access TOKEN. (2) **Worse and silent** — the
  orphan lines had pushed `setDone(true)` clean out of the submit handler in BOTH
  `/signup` and `/reset-password`, so a successful signup or password change would
  have left the button stuck on "Creating your account..." forever with no
  confirmation panel and no error. Found only because the build error pointed at
  line 199, past the end of the component.
- **The secret scanner was wrong and failed every build.** It treated the
  `sb_publishable_` key as a leak. Verified the bundle held only that key and
  zero `sb_secret_` values BEFORE changing anything, then narrowed the pattern so
  only `sb_secret_` fails hard, and re-verified by planting a fake `sb_secret_` in
  a tracked file and in the build output — both still fail. Narrowed, not
  silenced.
- Left `frontend/src/app/phones/page.jsx` out of this commit: it carried an
  unrelated pre-existing uncommitted change (an error-swallowing try/catch) that
  does not belong mixed into an auth commit.
**State at the end:** Stage 6 code complete for BOTH Google and email/password.
`next build` passes with 15 routes; all four auth pages return 200; secret scan
passes; personas still 10/10. Committed `0c124a8`. Nothing pushed or deployed.
**Next steps:**
1. **OWNER:** enable the Google provider in Supabase and add the redirect URLs.
2. **OWNER (top blocker):** the email path needs a REAL SMTP provider. Mailgun
   cannot do it — the current domain is `type: sandbox` and SMTP auth returns 535
   (proven above). Add a real Mailgun domain, or switch to Resend/Brevo/Mailjet
   (all free tiers), then paste me the SMTP host/port/user/password and I will
   configure Supabase and re-test the whole signup flow end to end.
3. **OWNER:** set `profiles.role = 'admin'` for the first admin.
4. Stage 7 (admin products) and Stage 8 (admin orders) are unblocked.
5. Push to GitHub, then deploy.

### Session 14: 2026-10-01

**Agent/model:** Cline
**Goal of the session:** The owner said "continue" after the SMTP walkthrough. The
SMTP task needs a real sending domain and is the owner's, so the agent picked the
highest-value work that needs nothing from them: **Stage 7, admin products and
stock**, which had been unblocked since the role gate landed in Session 13.
**What was done:**

- **Stage 7 code DONE.** `backend/src/admin.js` + routes on
  `GET/POST /admin/products` and `PUT /admin/products/:id`, all behind
  `requireAdmin`. Frontend `/admin` and `/admin/products`, with create, edit,
  stock, active toggle and all nine model spec fields.
- **The product id is DERIVED, never accepted from the request.** This was the
  subtle part: `products.id` is the same id the model returns in a
  recommendation (D36). A product the shop invented an id for could never be
  recommended, and if the two ids disagreed the shopper could not buy what the
  model suggested.
- **Feature 26 implemented as a WARNING, not a block.** Each product carries
  `missing_model_features`; the UI shows "Missing specs: ...". An admin adding a
  phone before the model knows it is a normal situation, not a mistake to punish.
- **Stock defaults to 0 on create, deliberately NOT 10.** A phone nobody has
  counted must not go on sale because someone typed a name into a form.
- **The one destructive edit asks for a second click.** Going from for-sale to
  stock 0 takes a phone off sale AND out of the model's candidates, so the form
  warns and waits. Going 0 to 0 does not re-warn, because warning every time
  would train the admin to click through it without reading.

**Decisions made:** no new decision. D36 (database owns price and stock) and the
Stage 7 row in section 13 already governed this work.
**Problems or errors:**

- **The chunked-write seam problem happened AGAIN, in `admin.js`.** Writing it in
  two chunks left `module.exports` stranded mid-file, split the body of
  `missingModelFeatures`, and left orphan lines at the end. Caught by
  `node --check` plus noticing `admin exports:` printed EMPTY. Now checking
  `require()` output, not just syntax, before moving on.
- **Two real bugs the tests caught, not the build:**
  1. `createProduct({brand:'X', price_ngn:100})` with NO `name` key reached the
     database and failed on a not-null constraint. Cause: required-field checks
     lived INSIDE the loop over writable keys, so a body that simply omitted
     `name` never visited it. Moved the checks AFTER the loop.
  2. `createProduct` had no id at all, and `products.id` has no database default
     (it is the model's id). Added `nextAvailableId()` with the same `+` to
     `plus` rule the M3 builder uses.
- **My own test harness lied to me first.** The validation cases all printed
  "FAIL, was accepted" because I called an ASYNC function in a try/catch without
  `await`, so every rejection escaped as an unhandled promise. The validation was
  correct; the test was wrong. Re-run with `await`, all 7 cases pass.
- **A `sed` over-corrected an import path.** Fixing `../../lib/api` to
  `../../../lib/api` also rewrote `/admin/page.jsx`, which is only ONE level below
  `app/` and needs `../../`. The build caught it.
- **I overwrote `fetchQuestionnaire` in `api.js`** when inserting the admin
  functions, and briefly added a self-import. Both fixed before the build.
**State at the end:** Stages 1, 2, 3, 4, 5, 7, 9 done. Stage 6 code complete for
Google and email. Committed `2f4ee9d`. Personas 10/10, `next build` passes with
17 routes, secret scan passes. Verified live: 401 on all four admin routes with no
token, 401 for a forged `role:admin` JWT, 200 for public shop routes, and a real
create/update/delete cycle against Supabase ending back at 63 products.
**Next steps:**
1. **OWNER: promote the first admin** — sign in, then set `profiles.role =
   'admin'`. Until then `/admin` correctly refuses everyone, so the owner cannot
   see his own admin page.
2. **OWNER: Stage 8 (admin orders) is next**, now fully unblocked.
3. **OWNER: Google provider** and **a real SMTP provider** (Resend recommended;
   Mailgun's current domain is a sandbox and cannot do SMTP).
4. Rotate the Supabase DB password and the Mailgun private key before deploying.

### Session 15: 2026-10-01
**Agent/model:** GitHub Copilot
**Goal of the session:** Check the running website and estimate remaining work.
**What was done:** Opened the local home, catalog, and admin routes. Home and catalog rendered; catalog showed 63 phones and correctly marked Redmi 13C out of stock. The frontend and backend returned HTTP 200 on local checks. Editor diagnostics reported no errors in the current admin-orders API/backend files. The admin page stayed on "Checking your access". Reviewed current uncommitted Stage 8 changes and recorded them as in progress. Estimated local functionality at about 75% complete and launch readiness at about 30%; these are rough milestone estimates, not test-coverage measurements.
**Decisions made:** None.
**Problems or errors:** The browser session contains earlier errors from an intermediate malformed edit in `frontend/src/lib/api.js`; current editor diagnostics are clear, but the fresh production build check was skipped, so the current full build is unverified. Stage 8 remains uncommitted, and no public deployment has been made.
**State at the end:** Local shopper home/catalog render. Stage 8 admin-order work is in progress. `/admin` does not get past session loading, and admin access is not confirmed. No deployment.
**Next steps:** 1) Diagnose why the admin auth loading state does not settle. 2) Run a fresh frontend build and complete Stage 8 route/status/email/restock checks. 3) Finish Stage 10 logging/feedback and Stage 11. 4) Complete owner auth setup and first-admin promotion, rotate leaked credentials, then deploy.

### Session 16: 2026-10-02

**Agent/model:** Cline
**Goal of the session:** Owner set the priority for the final push: **deploy to
Netlify and Vercel, add Google auth, and fix the model prediction not working.**
Submission is near, so speed mattered more than new features.
**What was done:**

- **Diagnosed "model prediction not working" instead of assuming it.** The model
  service was **healthy the whole time**: `/health` returned `model_loaded: true`
  and a direct `/recommend` returned ranked picks in **1.3s**. Two things had been
  mistaken for a broken model:
  1. My own test payloads used hand-typed questionnaire labels that do not exist
     in the config. The mapper correctly rejected them with the list of valid
     labels. This is the **fourth** time a hand-typed payload cost a cycle.
  2. The backend on port 4000 was a **stale process from 07:54**, started before
     the current code. It returned `502 "model service unreachable"` while
     `/model/version` worked, because it ran the pre-`available_ids` code.
     Restarted it and the full chain answered in **1.6s**.

- **Found the three blockers that would have made the deploy fail, all of them
  production-only, which is exactly why local testing never caught them.**
  1. **The model service could not start on a fresh clone at all.** Verified by
     actually cloning the repo: importing the recommender raised
     `FileNotFoundError` for `ml_model.joblib`, because that 41 MB artifact is
     git-ignored and `ml_recommender.py` loads it at import time. Every shopper
     would have seen "our recommendation model is not available". Fixed with
     `model/service/Dockerfile`, which **trains the model during the image
     build** from the committed `training_data.csv`. Measured at 27s, no network
     needed, and the build fails loudly instead of shipping a dead image.
  2. **The model loaded lazily, so `/health` lied.** Render and Railway decide
     health by polling `/health`, so a container that could not serve predictions
     would have been marked healthy. Added a startup hook so the catalog and
     forest load before the service reports ready.
  3. **Two data files would not exist in a Netlify deploy.** `phones.csv` and
     `questionnaire_v1.json` are read at runtime via paths built from `__dirname`,
     and Netlify uses base directory `backend` with esbuild bundling, so those
     paths resolve outside the deployed zip. `included_files` cannot reach above
     the base directory, so both files are now copied into `backend/model_data/`
     by `npm run sync:model-data`. Because a second copy of the questionnaire
     could drift from the one the model scores — making the shop ask different
     questions than the model answers — `npm run check:model-data` **exits 1** on
     drift. Verified both directions: 1 when tampered, 0 when clean.

- **Verified the deploy fix the only way that proves it: built from a clean copy.**
  Copied `model/` to a scratch dir, deleted the artifact, ran the exact Docker
  build steps, then started the service. It trained, booted and returned ranked
  picks. Docker is installed but **no daemon is running**, so `docker build` could
  not be run directly; the simulation covers the same steps.
- **Pushed to GitHub for the first time in 15 sessions** (`main` = `4ebcbda`).
  Both Vercel and Netlify need the code on GitHub to connect it, so this was
  blocking all three deploys, not just tidying.
- **Wrote exact deploy steps into README**: all three services, the env var names
  for each, and the verification curl commands. Recorded the Render **free-tier
  warning**: it sleeps 30-60s, longer than Netlify's 10s function limit, so the
  first shopper after a quiet period would fail. D35 requires a warm instance.

**Decisions made:** none new. D35 (warm container, never serverless) is unchanged;
this session is what makes it satisfiable, since before this there was no way to
deploy the model at all.
**Problems or errors:**
- A `global _LOAD_ERROR` statement placed inside an `except` block in the new
  startup hook. Moved to the top of the function. Caught by `ast.parse`.
- **An `included_files` entry pointing at `../model/...` would have been silently
  ignored** — it cannot escape the base directory. Replaced the approach entirely.
- Two of my own calls failed before any real diagnosis: a `node -e` test reporting
  "Cannot read properties of null" because it never loaded `.env` (the code was
  correct), and a `$?` that captured `tail` rather than `npm`, briefly making the
  drift check look like it always exits 0. Re-measured: 1 on drift.
- Stale backend process on port 4000 again (see above). Third time in this project
  that an old process answered a test.
**State at the end:** Model track M1-M4 and M7 **done and now deployable**. Code
committed and **pushed to GitHub** (`4ebcbda`), including the previously
uncommitted Stage 8 admin-orders work. 10/10 personas pass, frontend build passes
with all 18 routes, secret scan clean, full local chain answers in 1.6s. **Nothing
deployed yet** — the three deploys need the owner's accounts.
**Next steps:**
1. **OWNER: deploy in order** — model service (Render, Docker, **Free plan** — no
   payment needed), then backend (Netlify, base dir `backend`), then frontend
   (Vercel, root dir `frontend`). README "Deploying" has every click and env var.
   Set the `MODEL_SERVICE_URL` GitHub secret so the keep-awake ping works.
2. **OWNER: Google sign-in** — enable the provider in Supabase and add the Vercel
   redirect URL. No code needed; the code is complete.
3. Verify the deployed chain with the curl commands in README.
4. Stage 10's remaining gaps (session logging, feedback buttons), Stage 8
   end-to-end checks, Stage 11.
5. Rotate the Supabase DB password and the Mailgun private key.

**Session 16b — the model made deployable in a serverless-friendly size.**

The owner asked for the model to work and for the deploys to be simple. Measuring
the artifact rather than trusting the earlier note produced the key result of the
session:

| | before | after |
|---|---|---|
| `ml_model.joblib` | 41 MB | **13.5 MB** |
| cold load | 18.4s | **0.93s** |
| prediction (via backend) | 662ms | **421ms** |

**Why it matters:** 18.4s exceeds the 10s hard wall on a Netlify function by
nearly double. The old AGENTS.md note said the 41 MB artifact "forces a warm
container" — that was correct when written, but the real constraint was the
**uncompressed** size, not the architecture. `joblib.dump(..., compress=3)` is
lossless, and this was verified rather than assumed: the top-3 recommendations
came back **identical** (Camon 40 Pro 5G / 66.7, Camon 50 Pro 4G / 66.5, Camon 50
4G / 66.4) with and without compression.

`train_model.py` now saves compressed permanently, so every future build and
retrain inherits it. Retrained from the committed `training_data.csv`: artifact
13.5 MB, and `test_personas.py` still reports **PASS: 10 personas, all hard rules
held**. A first look showed the file at 317K, which was a mid-write snapshot, not
a broken model — confirmed by re-reading the log, which printed "13.5 MB".

D35 is unchanged as a decision; the model is still deployed as a warm container,
which remains the more reliable design. But the size limit that originally forced
it is no longer near its limit, so a free-tier Render instance is viable: a paid
instance is optional, not required.

**Session 16d — free-only hosting (the owner cannot pay for anything).**

Measured the constraints rather than assuming:

| Measurement | Value | Why it matters |
|---|---|---|
| Peak RSS after import, load and predict | **231 MB** | Fits Render free's 512 MB |
| Model load alone | **1.11s** | The rest (7.27s) is sklearn/pandas import, unavoidable in Python |
| Forest as JSON | 19.5 MB, 300 trees, 587,790 nodes | Exported via `model/src/export_trees.py` |

**The real problem was never the model — it was the free tier's sleep.** Render's
free web services spin down after ~15 min idle and take 30-60s to wake, which is
longer than the Netlify function's ~10s limit. So the first shopper after a quiet
period would have failed. Solved with two layers, neither needing money:

1. `.github/workflows/keep-model-awake.yml` pings `/health` every 10 minutes, so
   the container never sleeps. Needs one repository secret, `MODEL_SERVICE_URL`.
   GitHub Actions has a free allowance and a 10-minute cron making one HTTP
   request is a negligible fraction of it.
2. If it is asleep anyway, the backend answers `502` **with `warming_up: true`**
   and fires a non-awaited ping at the container on the way out, and
   `postRecommendWithRetry` in the frontend retries (1.5s, 2.5s, 3s, capped
   under the function's 10s wall). Verified the whole cycle by killing the model:
   the request returned `warming_up: true`, then succeeded once it was back.

The retry only fires on `warming_up`, so a genuinely bad answer still fails fast
instead of making a shopper wait for nothing.

A bug was caught while wiring this up: `apiFetch` threw a plain `Error` and so
dropped the `warming_up` flag on the floor. The retry would then never have
triggered, and would have looked like it worked because the happy path was
untouched.

`export_trees.py` was written during this investigation, when the question was
whether a free tier could run the model at all. **It is not wired into anything**
and is kept only because it makes the forest inspectable without Python. It is
not on the deployment path, and should not be mistaken for part of it.

**Session 16c — deploy login.**

Owner asked for the deploys to be done for them. Hosting providers will not
accept a deploy from an unauthenticated machine, so one browser login each for
Vercel, Netlify and Render is the only step that cannot be automated away.
`scripts/deploy-login.sh` does exactly that, in order, using `npx` rather than a
global install (the npm registry is very slow on this machine and a global
install added a long wait before the owner could even start). Logins are stored
in the CLIs' own home directories, never in the repo.

Also verified the Netlify layout under real conditions rather than by inspection:
a copy of `backend/` with `model/` **deleted entirely** — the deployed situation,
since Netlify uses base directory `backend` — still served `GET /questionnaire`
from the bundled `model_data` copy and listed all **63 products** from the CSV
fallback. That is exactly the failure mode Session 16 fixed, confirmed fixed.

### Session 17: 2026-10-02
**Agent/model:** GitHub Copilot
**Goal of the session:** Refresh the storefront UI, replace the light-blue palette with a researched color scheme, and improve responsiveness across screen sizes and browser engines.
**What was done:** Replaced blue/indigo accents with a role-based palette: deep green primary, darker green emphasis, pale green and terracotta-tinted surfaces, and neutral backgrounds. The green/coral pair is near-complementary; WCAG contrast measured 5.69:1 for white on primary green and 8.03:1 on dark green. Coral on white measured 2.88:1, so it remains decorative and is not used for small text. Fixed mobile header action wrapping, changed price filters to two columns on narrow screens, and set the cart to one column below desktop after detecting a 467px cart layout on a 375px viewport. Chromium checks covered home, catalog, questionnaire, cart and checkout at 320, 375, 768 and 1280px with no horizontal overflow after the fix; the catalog was also checked at 360, 430, 1024 and 1440px. `npm run build` and the secret scanner passed. Updated browser screenshot confirms the new mobile home UI.
**Decisions made:** D41 (assumed storefront palette and color-role use).
**Problems or errors:** Firefox and WebKit downloads completed, but automated launch is blocked by missing host libraries (`libasound2t64` for Firefox and GTK/GStreamer and other libraries for WebKit). No elevated system package installation was attempted. The built-in browser checks ran in Chromium only.
**State at the end:** Updated UI is locally available; production build passes. The working tree also contains the owner's unrelated, uncommitted Stage 8 admin-orders changes; they were left untouched. No public deployment.
**Next steps:** If cross-engine certification is needed, install the Playwright host dependencies with an administrator. Continue the existing deployment/auth tasks; no further UI work is required for this request.
