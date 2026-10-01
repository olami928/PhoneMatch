# Stage 3 setup: connect the shop to Supabase

**Status: step 1 is all that is left.** The keys are already in `backend/.env`
(done). Only the SQL below still needs you.

## 1. Run the schema (the only step left)

1. Open https://supabase.com/dashboard/project/iwcxwxoiqzwncmvfdrzd/sql/new
2. Open `backend/src/db/RUN_THIS_IN_SUPABASE.sql`, copy **everything**, paste it
   into that editor, click **Run**.

That single file contains both the tables and the row-level security rules, so
there is nothing to run afterwards.

The script is safe to run more than once (every statement is `if not exists` /
`drop policy if exists`), so a mistake will not destroy data.

You should see `products`, `profiles`, `orders`, `order_items`,
`order_status_history` and `recommendation_sessions` in the Tables list.

> Why you run this and not me: this machine cannot reach the Postgres port, and
> the Supabase Management API needs a personal access token, so there is no way
> for me to create the tables. Everything after this point I can do.

## 2. Keys — DONE, no action needed

They are already saved in `backend/.env` (git-ignored, `600` permissions) and I
confirmed neither key appears in any tracked file.

Note that Supabase renamed these. `sb_publishable_...` is the old `anon` key and
is designed to be visible in the browser. `sb_secret_...` is the old
`service_role` key: it bypasses row level security entirely, so anyone holding it
can read every order and customer address. It stays in the backend, and it must
be rotated (see the last section) because it was pasted into a chat.

## 3. Load the 63 phones

I run this for you. From the `backend/` folder:

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

## 4. Rotating the secret key — do this after we finish testing

The secret key and the database password were both pasted into a chat, so treat
both as exposed. Rotate them once the site works, then update `backend/.env`:

- Secret key: Supabase -> Project Settings -> API Keys -> reveal -> regenerate
- Database password: Supabase -> Project Settings -> Database -> reset password
  (then update both `SUPABASE_DB_PASSWORD` and `DATABASE_URL`)

After rotating, **never paste the new one into a chat.** Write it straight into
`backend/.env` and tell me only that you did. I can read the file without you
ever showing me the value.

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
