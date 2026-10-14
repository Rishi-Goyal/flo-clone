-- Keep-alive heartbeat. Free Supabase projects pause after a week without
-- "sufficient user database activity" (docs: "a few user requests to the
-- database each day"). An anonymous REST read that RLS filters to [] every
-- 3 days proved NOT to be enough (paused 3x), so the GitHub keep-alive now
-- calls this function several times a day: a real WRITE plus reads of the
-- real tables, executed as an API (anon) user. Run after 004.

create table if not exists public.keepalive (
  id int primary key default 1 check (id = 1),   -- single row, bounded storage
  pinged_at timestamptz not null default now(),
  ping_count bigint not null default 0
);

alter table public.keepalive enable row level security;
-- no policies on purpose: only reachable through keepalive_ping()

create or replace function public.keepalive_ping()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  r public.keepalive%rowtype;
begin
  insert into public.keepalive (id, pinged_at, ping_count)
  values (1, now(), 1)
  on conflict (id) do update
    set pinged_at = now(), ping_count = public.keepalive.ping_count + 1
  returning * into r;

  -- touch the real tables so the activity looks like genuine app use
  perform count(*) from public.profiles;
  perform count(*) from public.log_entries where date >= current_date - 7;

  -- nothing sensitive is returned
  return jsonb_build_object('pinged_at', r.pinged_at, 'count', r.ping_count);
end;
$$;

revoke all on function public.keepalive_ping() from public;
grant execute on function public.keepalive_ping() to anon, authenticated;
