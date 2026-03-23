create table if not exists public.kv_store_5d6242bb (
  key text primary key,
  value jsonb not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists kv_store_5d6242bb_key_prefix_idx
  on public.kv_store_5d6242bb (key text_pattern_ops);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_kv_store_5d6242bb_updated_at on public.kv_store_5d6242bb;
create trigger set_kv_store_5d6242bb_updated_at
before update on public.kv_store_5d6242bb
for each row
execute function public.set_updated_at();

alter table public.kv_store_5d6242bb enable row level security;
