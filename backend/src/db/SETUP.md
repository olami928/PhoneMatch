# Stage 3 setup: connect the shop to Supabase

You need to do three things. They take about 10 minutes total.

## 1. Run the schema (creates the tables)

1. Open https://supabase.com/dashboard/project/iwcxwxoiqzwncmvfdrzd/sql/new
2. Paste the whole of `backend/src/db/schema.sql` and click **Run**
3. Repeat with `backend/src/db/row_level_security.sql`

Both files are written to be safe to run more than once (every statement is
`if not exists` / `drop policy if exists`), so a mistake does not destroy data.

You should see `products`, `profiles`, `orders`, `order_items`,
`order_status_history` and `recommendation_sessions` in the Tables list.

## 2. Add the two API keys

Both are on the same page: **Project Settings -> API** (or the "API Keys" section
in the new dashboard layout).

- `anon` public key: goes in the frontend, it is designed to be visible
- `service_role` key: goes in the BACKEND ONLY. It bypasses row level security,
  so anyone holding it can read every customer's order. Never put it in frontend
  code, never commit it, never paste it into a chat.

Edit `backend/.env` and fill in the two blank lines. The URL and password are
already there. Do not delete that file, and do not commit it (it is already
git-ignored).

## 3. Load the 63 phones

From the `backend/` folder:

```bash
npm run seed
```

It reads `model/data/phones.csv`, the same file the model scores, and upserts
into the `products` table. You should see:

```
read 63 phones from phones.csv
upserted 63 products
products now in the database: 63
all product ids present, model and shop agree
```

That last line is the important one: it is the check that the model can never
recommend a phone the shop cannot buy.

## Rotating the database password

The password was shared in a chat message, so treat it as exposed. Supabase ->
Project Settings -> Database -> reset password. Then update
`SUPABASE_DB_PASSWORD` and `DATABASE_URL` in `backend/.env`.

## The first admin

`profiles.role` decides who can see `/admin`. There is deliberately NO insert
policy for `profiles`, so nobody can grant themselves the admin role. The first
admin is created by hand:

```sql
insert into public.profiles (id, email, full_name, role)
select id, email, raw_user_meta_data->>'full_name', 'admin'
from auth.users
where email = 'YOUR-EMAIL-HERE';
```

Run that AFTER you have signed in once with Google, because the row above reads
from `auth.users`.
