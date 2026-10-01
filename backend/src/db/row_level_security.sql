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
