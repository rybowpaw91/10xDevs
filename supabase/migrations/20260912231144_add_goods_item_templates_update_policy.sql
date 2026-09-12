create policy "goods_item_templates_update_own"
  on goods_item_templates
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
