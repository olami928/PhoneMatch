# Phone shop (working title)

A phone shop where shoppers answer a few questions and our own model tells them
which phone fits their needs best.

This is the monorepo. Read `AGENTS.md` first: it holds the plan, the decisions,
and the session log. `API_CONTRACT.md` holds the agreed API shapes.

## Folders

| Folder | What lives there |
|---|---|
| `frontend/` | Next.js app (shop and admin UI). Hosted on Vercel. |
| `backend/` | Express API, runs locally and as a Netlify Function. Hosted on Netlify. |
| `model/` | Python recommender and data. `model/legacy/` holds the owner's original model. |
| `docs/` | Extra notes that do not belong in AGENTS.md. |

## Run it locally

Two terminals. Backend first, then frontend.

**Backend** (port 4000):

```bash
cd backend
npm install
npm run dev
```

Check it works: open `http://localhost:4000/hello` in a browser. You should see JSON with a message.

**Frontend** (port 3000):

```bash
cd frontend
npm install
npm run dev
```

Check it works: open `http://localhost:3000`. The page fetches the message from the backend and shows it. When both are running, you see the backend's message. If the backend is stopped, the page shows a clear error instead of crashing.

## How the two parts talk

The frontend only calls the backend. It reads the backend address from
`frontend/.env.local` (`NEXT_PUBLIC_API_URL`). Local default is
`http://localhost:4000`. The deployed backend will be `https://<netlify-site>/api`.

## Deploying

Three services on three providers. **Deploy the model service first** — the
backend calls it, and `/recommend` returns "our recommendation model is not
available" until it is live.

| # | Service | Provider | Folder |
|---|---|---|---|
| 1 | Model API (FastAPI) | Render or Railway | repo root, uses `model/service/Dockerfile` |
| 2 | Backend API (Express) | Netlify | base directory `backend` |
| 3 | Frontend (Next.js) | Vercel | root directory `frontend` |

### Before you push

```bash
cd backend && npm run check:model-data   # fails if the bundled data copies drifted
```

### 1. Model service (do this first)

Render: New → Web Service → connect the repo → **Docker** → Dockerfile path
`model/service/Dockerfile` → Environment `Python`.

The Dockerfile **trains the model during the build** (~27s). This is deliberate:
`ml_model.joblib` is git-ignored, so a service built from a plain clone has no
model at all and dies with `FileNotFoundError` on startup. The build step reads
the committed `training_data.csv`, needs no network, and fails loudly rather
than shipping a dead image.

The model is saved **compressed** (13.5 MB, loads in 0.93s). That was measured,
not assumed: uncompressed it is 41 MB and takes 18.4s to load, which alone
blows past a serverless function's time limit. Compression is lossless — the
top-3 recommendations are identical either way.

Use a **paid or trial instance, not the free tier** if you can. Free sleeps
after inactivity for 30–60s, longer than the Netlify function's 10s limit, so
the first shopper after a quiet period would see a failure. The model now starts
in well under that, but a cold *container* still has to boot first.

Copy the deploy URL, e.g. `https://phonematch-model.onrender.com`.

### 2. Backend (Netlify)

- Base directory: `backend` · Build command: *(blank)* · Publish directory: *(blank)*

Environment variables (secrets — set these in the Netlify UI, never commit them):

| Variable | Value |
|---|---|
| `MODEL_SERVICE_URL` | the model URL from step 1, **no trailing slash** |
| `ALLOWED_ORIGINS` | your Vercel URL, once it exists |
| `SUPABASE_URL` | from `backend/.env` |
| `SUPABASE_SECRET_KEY` | from `backend/.env` |
| `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `MAILGUN_API_BASE`, `MAILGUN_FROM`, `MAILGUN_ALLOWED_RECIPIENTS` | from `backend/.env` |

Check: `https://<site>.netlify.app/api/health` should return `{"status":"ok"}`.

### 3. Frontend (Vercel)

Root directory `frontend`, framework auto-detected as Next.js.

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://<site>.netlify.app/api` |
| `NEXT_PUBLIC_SUPABASE_URL` | from `frontend/.env.local` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | from `frontend/.env.local` |

The `NEXT_PUBLIC_` values are public by design (D40). The publishable key is safe
in the browser because row-level security limits what it can do; only `sb_secret_`
is a genuine leak.

### 4. Google sign-in (dashboard steps, no code)

The code is complete and needs no changes. Two steps:

1. **Supabase → Authentication → Providers → Google**: turn it **ON**, then paste
   the Google Client ID and Client Secret from Google Cloud Console.
2. **Supabase → Authentication → URL Configuration → Redirect URLs**: add
   `https://<your-vercel-domain>/auth/callback` and `http://localhost:3000/auth/callback`.

Then set `profiles.role = 'admin'` for the first admin. Admin is never
self-assignable, by design (D38).

Note: email/password **sign-up** additionally needs a real SMTP provider. The
current Mailgun domain is a **sandbox**, which cannot authenticate over SMTP, so
Supabase's own confirmation emails will not send until that is replaced. Google
sign-in is unaffected, because it sends no email.

### 5. Verify after deploying

```bash
curl https://<site>.netlify.app/api/health    # {"status":"ok"}
curl https://<model-url>/health               # "model_loaded": true

curl -X POST https://<site>.netlify.app/api/recommend \
  -H 'Content-Type: application/json' \
  -d '{"budget":"NGN 300,000 - 500,000","main_use":"Photos and video",
       "top_priority":"Camera","storage":"Medium (128GB)",
       "brand_preference":"No preference"}'
```

That last call must return ranked phones. If it returns the "not available"
message, `MODEL_SERVICE_URL` is wrong or the model service is asleep.

> Rotate the Supabase database password and the Mailgun private key before a real
> launch — both are in the project chat history.

## Stage status

See the Status board and the build stages in `AGENTS.md`. Stage 1 (frontend and
hello-world backend, connected locally) is built and being verified.
