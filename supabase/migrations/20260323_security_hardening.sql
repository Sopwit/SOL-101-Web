do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'blockchain_transactions',
    'forum_comments',
    'forum_posts',
    'inventory_items',
    'market_listings',
    'players'
  ]
  loop
    if exists (
      select 1
      from pg_tables
      where schemaname = 'public'
        and tablename = table_name
    ) then
      execute format('alter table public.%I enable row level security', table_name);
      execute format('revoke all on public.%I from anon, authenticated', table_name);
    end if;
  end loop;
end $$;

do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'update_player_stats'
  ) then
    execute 'alter function public.update_player_stats() set search_path = public, pg_temp';
  end if;
end $$;
