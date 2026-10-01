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

## Stage 3 and 6 routes (built)

### `GET /products`

Public. Reads the **`products` table in Supabase**, so the stock shown in the shop
is the same stock `POST /orders` decrements. It falls back to
`model/data/phones.csv` only when Supabase is not configured, and the response
says which source answered via `source` (`"database"` or `"csv"`).

The CSV is still the source for the specs the **model** scores; the database is
the source for **price and stock**. Both use the same `product_id`.

Query parameters (all optional):

| Param | Meaning |
|---|---|
| `min_price` | inclusive lower bound in naira |
| `max_price` | inclusive upper bound in naira |
| `brand` | exact brand match |
| `in_stock` | `true` to show only phones with stock |
| `search` | matches name or processor, case-insensitive |

A non-numeric price is a `400` with a message written to be shown to the shopper.

```json
{
  "count": 9,
  "total": 63,
  "brands": ["Samsung", "TECNO", "Xiaomi"],
  "source": "database",
  "products": [{ "product_id": "...", "name": "...", "price_ngn": 98100, "stock": 0 }]
}
```

### `GET /products/:id`

Public. 404 when the id is unknown. Response: `{ "product": { ... } }`.

### `GET /auth/me` (Stage 6)

Public. Tells the frontend who is calling. Always `200` — "not signed in" is a
normal answer, not an error.

Request header (optional): `Authorization: Bearer <supabase access token>`

```json
{ "signed_in": false }
```

```json
{ "signed_in": true, "email": "...", "name": "...", "role": "customer", "user_id": "..." }
```

The role comes from the `profiles` table, never from the request and never from
the token's claims. A profile row is created on first sign-in with role
`customer`; the first admin is promoted by hand in Supabase.

### `GET /admin/ping` (Stage 6)

Admin only. Reference example for every future admin route.

| Case | Status |
|---|---|
| no token | `401` |
| invalid or forged token | `401` |
| valid token, role `customer` | `403` |
| valid token, role `admin` | `200` |

Tokens are verified with Supabase, so a hand-written JWT claiming
`{"role":"admin"}` is rejected. **A token in the request body is ignored
entirely** — identity comes only from the verified `Authorization` header.

### `GET /questionnaire`

Public. Serves the frozen questionnaire from `model/config/questionnaire_v1.json`
with all internal notes (`why`, `alias_of`, internal `__price__` keys) stripped.
The frontend never hardcodes a question, so rewording needs no code change.

### `POST /recommend`

Public. Proxies to the model service.

Request — answers at the **top level**, using the labels the questionnaire
returned:

```json
{
  "budget": "NGN 300,000 - 500,000",
  "main_use": "Photos and video",
  "top_priority": "Camera",
  "storage": "Medium  (128GB is enough)",
  "brand_preference": "itel"
}
```

`brand_preference` may be omitted or `"No preference"`.

The backend also sends `available_ids`: the product ids the shop can sell right
now (active, stock > 0), read from the `products` table. The model applies it as
an **intersection**, so it can only ever remove candidates — the hard filters
(budget, storage, stock, active) still run afterwards and keep the final say. This
is what stops the model recommending a phone that just sold out, since the CSV's
own `stock` column does not change when an order is placed. It is omitted
entirely when the database is unreachable, so a misconfigured deploy degrades to
stale stock rather than returning no recommendations at all.

Response: `{ "model_version": "rf-shop-0.1", "recommendations": [...], "message": "...", "live_stock_applied": true }`

- `message` is present only when the catalog is too thin to fill every slot.
- `live_stock_applied` is `false` when live stock could not be applied.

---

## Stage 5 routes (built)

### `POST /orders`

Public — guest checkout is allowed (D12), so no token is required.

**Request** — the client sends ids and quantities ONLY:

```json
{
  "full_name": "Dimeji",
  "email": "buyer@example.com",
  "phone": "08030000000",
  "address_line": "12 Test Street, Ikoyi",
  "city": "Lagos",
  "state": "Lagos",
  "items": [{ "product_id": "xiaomi-redmi-13c", "quantity": 2 }]
}
```

**Any `price_ngn`, `line_total`, `subtotal`, `delivery` or `total` sent by the
client is ignored.** The server re-reads every price from the catalog. This was
tested by sending `price_ngn: 1`: the order was charged the real ₦98,100.

Rules enforced server-side: max 20 of one phone per order; stock is deducted with
a conditional update so two shoppers cannot both take the last one.

**Response `201`:**

```json
{
  "order_id": "uuid",
  "status": "Pending",
  "created_at": "...",
  "email": "...", "full_name": "...",
  "items": [{ "product_id": "...", "name": "...", "quantity": 2, "price_ngn": 98100, "line_total": 196200 }],
  "subtotal": 196200, "delivery": 5000, "total": 201200,
  "oversold": []
}
```

`oversold` lists anything that sold out mid-checkout. The confirmation page must
show it — silence there means a parcel simply never arrives.

Errors: `400` validation (bad email, empty cart, over the quantity cap),
`503` when the database is not configured.

Fires the customer confirmation email and the admin new-order alert.

### `GET /orders/:id`

Public for now — powers the confirmation page. It returns only what the buyer
themselves supplied. **Stage 6 must add an owner check here**: a signed-in
shopper should see only their own orders, and guests should present a token.

Response: `{ "order": { ... } }` with the SAME money field names as
`POST /orders` (`subtotal`, `delivery`, `total`) plus a flattened `shipping`
object. These two routes previously disagreed and the confirmation page silently
rendered an em-dash for every total; they now share one shape deliberately.

---

### `GET /model/version`

Proxies the model service so the frontend can show which model produced a
recommendation without knowing the model's address. Returns
`{ "model_version": "...", "service_status": "ok" | "unreachable" }`.

Response `200` with `service_status: "unreachable"` when the model service is
down. It deliberately does NOT return `503`: a shopper's cart must not appear
broken because the model is offline, and the shop pages do not depend on this.

---

## Planned routes (not built yet)

| Method | Route | Who | Stage |
|---|---|---|---|
| GET | `/orders/mine` | Signed-in users | 6 |
| POST | `/recommend/:sessionId/feedback` | Everyone | 3 (needs sessions) |
| POST | `/admin/products` | Admin only | 7 |
| PUT | `/admin/products/:id` | Admin only | 7 |
| GET | `/admin/orders` | Admin only | 8 |
| PATCH | `/admin/orders/:id/status` | Admin only | 8 |
| GET | `/admin/model/stats` | Admin only | 11 |

**Note:** `/products` still reads the CSV, not the `products` table. The table is
seeded and stock IS decremented there on every order, so the product list will
show stale stock until this is switched over. That switch is the real Stage 3
goal and is still outstanding.
