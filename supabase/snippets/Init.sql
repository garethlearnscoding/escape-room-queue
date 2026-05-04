create table queue (
  queue_number serial primary key,
  name text not null,
  status text not null default 'waiting' check (status in ('waiting', 'notified', 'served')),
  token text not null,
  joined_at bigint not null,
  notified_at bigint
);

create table used_tokens (
  token text primary key,
  used_at bigint not null
);

alter table queue enable row level security;
alter table used_tokens enable row level security;

create policy "deny public queue access" on queue for all using (false);
create policy "deny public token access" on used_tokens for all using (false);

create or replace function get_active_queue()
returns setof queue language sql security definer as $$
  select * from queue
  where status in ('waiting', 'notified')
  order by queue_number asc;
$$;

create or replace function get_served_count()
returns bigint language sql security definer as $$
  select count(*) from queue where status = 'served';
$$;