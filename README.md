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

## Stage status

See the Status board and the build stages in `AGENTS.md`. Stage 1 (frontend and
hello-world backend, connected locally) is built and being verified.
