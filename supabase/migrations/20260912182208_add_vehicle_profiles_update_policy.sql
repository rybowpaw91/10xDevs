create policy "vehicle_profiles_update_own"
  on vehicle_profiles
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
