-- schema.sql — the shop's database tables (Stage 3).
--
-- Run this once in Supabase -> SQL Editor -> New query -> paste -> Run.
-- It is written to be safe to re-run: every statement is IF NOT EXISTS, so
-- running it twice will not wipe data.
--
-- product_id is the SAME id used in model/data/phones.csv. That shared id is
-- what stops the model recommending a phone the shop cannot sell.

-- ---------------------------------------------------------------- products
-- The single source of truth for what can be bought. Seeded from
-- model/data/phones.csv, so model rows and product rows always match.
create table if not exists public.products (
  id                  text primary key,          -- == phones.csv product_id
  name                text not null,
  brand               text not null,
  price_ngn           numeric(12,2) not null check (price_ngn > 0),
  description         text,
  image               text,
  stock               integer not null default 0 check (stock >= 0),
  active              boolean not null default true,

  -- model features. Kept in step with the questionnaire config and the model.
  price_tier          text,
  condition           text,
  ram_gb              real,
  storage_gb          real,
  battery_mah         real,
  main_camera_mp      real,
  selfie_camera_mp    real,
  refresh_rate_hz     real,
  display_inches      real,
  release_year        integer,
  processor           text,
  five_g              boolean,

  -- Honest data: which specs are estimates, so admin can fix them (Stage 7).
  imputed_any         boolean not null default false,
  imputed_fields      text,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists products_price_idx on public.products (price_ngn);
create index if not exists products_brand_idx on public.products (brand);
create index if not exists products_active_idx on public.products (active);

-- ---------------------------------------------------------------- profiles
-- One row per signed-in user. role gates every admin route.
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text,
  role        text not null default 'customer' check (role in ('customer','admin')),
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------------- orders
-- user_id is NULL for guests. Guest checkout is allowed (D12).
create table if not exists public.orders (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users (id) on delete set null,
  email          text not null,
  full_name      text not null,
  phone          text,
  address_line   text,
  city           text,
  state          text,
  total_ngn      numeric(12,2) not null check (total_ngn >= 0),
  delivery_ngn   numeric(12,2) not null default 0 check (delivery_ngn >= 0),
  status         text not null default 'Pending'
                 check (status in ('Pending','Paid','Packed','Shipped','Delivered','Cancelled')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists orders_user_idx on public.orders (user_id);
create index if not exists orders_status_idx on public.orders (status);

-- Price is stored per line at purchase time, so a later price change never
-- rewrites what the customer actually paid.
create table if not exists public.order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders (id) on delete cascade,
  product_id   text not null references public.products (id),
  quantity     integer not null check (quantity > 0),
  price_ngn    numeric(12,2) not null check (price_ngn >= 0)
);

create index if not exists order_items_order_idx on public.order_items (order_id);

create table if not exists public.order_status_history (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders (id) on delete cascade,
  status      text not null,
  changed_by  uuid references auth.users (id) on delete set null,
  changed_at  timestamptz not null default now()
);

-- ---------------------------------------------- recommendation_sessions
-- D23: every recommendation session is logged, so the model can be evaluated
-- and retrained later. user_id is NULL for guests; anonymous_id always exists
-- and is a random id, NOT personal data (see the model rules).
create table if not exists public.recommendation_sessions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references auth.users (id) on delete set null,
  anonymous_id      text,
  answers           jsonb not null,
  results           jsonb,
  model_version     text not null,
  feedback          text check (feedback in ('yes','no')),
  feedback_comment  text,
  added_to_cart     text[],
  purchased         text[],
  created_at        timestamptz not null default now()
);

create index if not sessions_model_version_idx on public.recommendation_sessions (model_version);
create index if not sessions_created_idx on public.recommendation_sessions (created_at);


 ==================================================================
  ROW LEVEL SECURITY — run this SECOND, in the same query or after.
  Without it, anyone with the publishable key can read every order,
  customer email and address. The publishable key is public.
 ==================================================================

-- row_level_security.sql — who may read and write what (AGENTS.md section 11).
--
-- Run AFTER schema.sql. Turn RLS on for every table.
--
-- WHY THIS FILE MATTERS: without RLS, ANYONE with the public anon key can read
-- every customer's name, email, address and order. The anon key is published in
-- the browser bundle, so it is not a secret. RLS is the only thing standing
-- between the public internet and the customer list.
--
-- The backend uses the service_role key, which bypasses RLS. That is why the
-- service_role key must never appear in frontend code.

alter table public.products                 enable row level security;
alter table public.profiles                 enable row level security;
alter table public.orders                   enable row level security;
alter table public.order_items              enable row level security;
alter table public.order_status_history     enable row level security;
alter table public.recommendation_sessions  enable row level security;

-- ------------------------------------------------------------------ products
-- Public read: the shop must display prices and specs to anyone, including
-- signed-out shoppers. No insert/update/delete policy at all, which means the
-- anon key cannot change a price or a stock level even if someone tries.
drop policy if exists products_select_public on public.products;
create policy products_select_public on public.products
  for select using (active = true);

-- ------------------------------------------------------------------ profiles
-- A shopper may read their own profile. Nobody may insert here: the backend
-- creates the row (using service_role) after the first sign-in, so a forged
-- sign-up cannot grant itself the admin role.
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (auth.uid() = id);

-- -------------------------------------------------------------------- orders
-- A signed-in shopper reads ONLY their own orders. Guests wrote their orders
-- through the backend with service_role, so they are not blocked from ordering;
-- they simply cannot read the order list directly from the browser.
drop policy if exists orders_select_own on public.orders;
create policy orders_select_own on public.orders
  for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------- order_items
-- Reachable only through an order the shopper already owns. Uses an EXISTS
-- subquery rather than trusting a column on the row itself.
drop policy if exists order_items_select_own on public.order_items;
create policy order_items_select_own on public.order_items
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.user_id = auth.uid()
    )
  );

-- ------------------------------------------------------- order_status_history
drop policy if exists order_status_history_select_own on public.order_status_history;
create policy order_status_history_select_own on public.order_status_history
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = order_status_history.order_id
        and o.user_id = auth.uid()
    )
  );

-- ---------------------------------------------- recommendation_sessions
-- No select policy on purpose. Session answers are behavioral data about a
-- person. The admin model page reads them with service_role from the backend,
-- so the browser never needs direct access.
