create table goods_item_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null,
  length numeric not null check (length > 0),
  width numeric not null check (width > 0),
  height numeric not null check (height > 0),
  rotatable boolean not null,
  stackable boolean not null,
  created_at timestamptz not null default now()
);

alter table goods_item_templates enable row level security;

create policy "goods_item_templates_select_own"
  on goods_item_templates
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "goods_item_templates_insert_own"
  on goods_item_templates
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "goods_item_templates_delete_own"
  on goods_item_templates
  for delete
  to authenticated
  using (auth.uid() = user_id);
