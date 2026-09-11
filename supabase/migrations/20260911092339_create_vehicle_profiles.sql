create table vehicle_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null,
  length numeric not null check (length > 0),
  width numeric not null check (width > 0),
  height numeric not null check (height > 0),
  created_at timestamptz not null default now()
);

alter table vehicle_profiles enable row level security;

create policy "vehicle_profiles_select_own"
  on vehicle_profiles
  for select
  using (auth.uid() = user_id);

create policy "vehicle_profiles_insert_own"
  on vehicle_profiles
  for insert
  with check (auth.uid() = user_id);

create policy "vehicle_profiles_delete_own"
  on vehicle_profiles
  for delete
  using (auth.uid() = user_id);
