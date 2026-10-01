# API_CONTRACT.md

The frontend and backend must agree on every route shape before it is built.
When a route changes, change it here in the same pull request.

Base URL

- Local: `http://localhost:4000`
- Deployed backend: `https://<netlify-site>/api` (Netlify redirects `/api/*` to the Express app)

All request and response bodies are JSON. Errors use the shape:

```json
{ "error": "Human readable message" }
```

---

## Stage 1 routes (built)

### `GET /hello`

Stage 1 proof route. The frontend calls this to show that the two parts are connected.

Response `200`:

```json
{
  "message": "Hello from the phone shop backend",
  "service": "backend",
  "time": "2026-10-01T12:30:00.000Z"
}
```

### `GET /health`

Used for deployment checks.

Response `200`:

```json
{ "status": "ok" }
```

---

## Planned routes (not built yet)

These come from AGENTS.md section 7. Shapes are confirmed with the frontend before each stage is built.

| Method | Route | Who | Stage |
|---|---|---|---|
| GET | `/products` | Everyone | 4 |
| GET | `/products/:id` | Everyone | 4 |
| POST | `/recommend` | Everyone | 10 |
| POST | `/recommend/:sessionId/feedback` | Everyone | 10 |
| POST | `/orders` | Guests and users | 5 |
| GET | `/orders/mine` | Signed-in users | 5 |
| POST | `/admin/products` | Admin only | 7 |
| PUT | `/admin/products/:id` | Admin only | 7 |
| GET | `/admin/orders` | Admin only | 8 |
| PATCH | `/admin/orders/:id/status` | Admin only | 8 |
| GET | `/admin/model/stats` | Admin only | 11 |
