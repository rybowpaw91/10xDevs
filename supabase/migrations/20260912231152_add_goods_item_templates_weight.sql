alter table goods_item_templates
  add column weight numeric check (weight > 0);
