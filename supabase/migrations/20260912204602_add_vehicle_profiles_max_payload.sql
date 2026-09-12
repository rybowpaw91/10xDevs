alter table vehicle_profiles
  add column max_payload numeric check (max_payload > 0);
