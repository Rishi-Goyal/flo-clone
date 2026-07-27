-- Bloom (Flo clone) — initial schema, RLS, and functions.
-- Run this in the Supabase SQL editor (or `supabase db push`) on a fresh project.

-- ============================================================ profiles

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  role text check (role in ('tracker', 'partner')),
  timezone text not null default 'Asia/Singapore',
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================ partner_links

create table public.partner_links (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  partner_id uuid references public.profiles (id) on delete set null,
  invite_code text not null unique
    default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  status text not null default 'pending' check (status in ('pending', 'active', 'revoked')),
  -- owner-controlled sharing flags
  share_phase boolean not null default true,
  share_predictions boolean not null default true,
  share_period_dates boolean not null default true,
  share_logs boolean not null default false,
  share_notes boolean not null default false,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

-- at most one non-revoked link per owner
create unique index one_live_link_per_owner
  on public.partner_links (owner_id)
  where status <> 'revoked';

-- ============================================================ trackers

create table public.tracker_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.trackers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  category_id uuid references public.tracker_categories (id) on delete set null,
  name text not null,
  icon text not null default 'Circle',        -- lucide icon name (PascalCase)
  color text not null default '#E4557F',
  input_type text not null check (input_type in ('boolean', 'scale', 'choice', 'multichoice', 'number', 'text')),
  config jsonb not null default '{}',         -- scale: {min,max,min_label,max_label}; choice: {options:[{value,label}]}; number: {unit}
  sort_order int not null default 0,
  is_active boolean not null default true,
  shared_with_partner boolean not null default false,
  system_key text,                            -- e.g. 'period_flow' — stable app hook that survives renames
  created_at timestamptz not null default now(),
  unique (user_id, system_key)
);

-- ============================================================ log_entries

create table public.log_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  tracker_id uuid not null references public.trackers (id) on delete cascade,
  date date not null,
  value jsonb not null,                       -- true | 4 | "medium" | ["happy","tired"] | "free text"
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, tracker_id, date)
);

create index log_entries_user_date on public.log_entries (user_id, date);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger log_entries_touch
  before update on public.log_entries
  for each row execute function public.touch_updated_at();

-- ============================================================ cycle_stats
-- One materialized prediction row per tracking user, upserted by the owner's
-- client after every flow-log change. The partner reads THIS row, so
-- phase-only sharing never requires exposing raw logs.

create table public.cycle_stats (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  last_period_start date,
  avg_cycle_length numeric,
  cycle_length_stddev numeric,
  avg_period_length numeric,
  predicted_next_start date,
  prediction_window_days int,
  fertile_window_start date,
  fertile_window_end date,
  ovulation_date date,
  current_phase text check (current_phase in ('menstrual', 'follicular', 'ovulation', 'luteal')),
  cycle_day int,
  confidence text check (confidence in ('high', 'medium', 'low')),
  updated_at timestamptz not null default now()
);

-- ============================================================ reminders

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  kind text not null default 'custom' check (kind in ('medication', 'birth_control', 'custom')),
  time_of_day time not null default '09:00',
  days_of_week int[] not null default '{0,1,2,3,4,5,6}',  -- 0 = Sunday
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================ helper: partner_can_view

create or replace function public.partner_can_view(p_owner uuid, p_flag text)
returns boolean
language plpgsql stable security definer set search_path = public
as $$
declare
  ok boolean;
begin
  if p_flag not in ('share_phase', 'share_predictions', 'share_period_dates', 'share_logs', 'share_notes') then
    return false;
  end if;
  execute format(
    'select exists (
       select 1 from public.partner_links
       where owner_id = $1 and partner_id = $2 and status = ''active'' and %I
     )', p_flag)
    into ok
    using p_owner, auth.uid();
  return coalesce(ok, false);
end;
$$;

-- ============================================================ RPC: accept_invite
-- SECURITY DEFINER so a partner can claim a pending link without any SELECT
-- policy on pending rows (prevents invite-code enumeration via the table).

create or replace function public.accept_invite(p_code text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  link public.partner_links%rowtype;
begin
  select * into link
  from public.partner_links
  where invite_code = upper(trim(p_code)) and status = 'pending';

  if not found then
    raise exception 'Invalid or already-used invite code';
  end if;

  if link.owner_id = auth.uid() then
    raise exception 'You cannot accept your own invite';
  end if;

  update public.partner_links
  set partner_id = auth.uid(), status = 'active', accepted_at = now()
  where id = link.id;

  update public.profiles
  set role = coalesce(role, 'partner')
  where id = auth.uid();

  return link.owner_id;
end;
$$;

revoke execute on function public.accept_invite(text) from anon, public;
grant execute on function public.accept_invite(text) to authenticated;

-- ============================================================ RLS

alter table public.profiles enable row level security;
alter table public.partner_links enable row level security;
alter table public.tracker_categories enable row level security;
alter table public.trackers enable row level security;
alter table public.log_entries enable row level security;
alter table public.cycle_stats enable row level security;
alter table public.reminders enable row level security;

-- profiles: self-manage; an active partner may read the owner's display name
create policy "own profile" on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

create policy "linked profiles visible" on public.profiles
  for select using (
    exists (
      select 1 from public.partner_links
      where status = 'active'
        and ((owner_id = profiles.id and partner_id = auth.uid())
          or (partner_id = profiles.id and owner_id = auth.uid()))
    )
  );

-- partner_links: owner full control; partner can see their active link and
-- self-revoke (but cannot touch sharing flags — column changes other than
-- status are blocked by the trigger below)
create policy "owner manages link" on public.partner_links
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "partner sees own link" on public.partner_links
  for select using (partner_id = auth.uid());

create policy "partner may self-revoke" on public.partner_links
  for update using (partner_id = auth.uid())
  with check (partner_id = auth.uid() and status = 'revoked');

create or replace function public.guard_partner_link_update()
returns trigger language plpgsql as $$
begin
  -- Only the owner may change anything except a partner flipping status to 'revoked'
  if auth.uid() = old.partner_id and auth.uid() <> old.owner_id then
    if new.status <> 'revoked'
       or new.owner_id <> old.owner_id
       or new.partner_id is distinct from old.partner_id
       or new.invite_code <> old.invite_code
       or new.share_phase <> old.share_phase
       or new.share_predictions <> old.share_predictions
       or new.share_period_dates <> old.share_period_dates
       or new.share_logs <> old.share_logs
       or new.share_notes <> old.share_notes then
      raise exception 'Partners may only revoke the link';
    end if;
  end if;
  return new;
end;
$$;

create trigger partner_link_update_guard
  before update on public.partner_links
  for each row execute function public.guard_partner_link_update();

-- tracker_categories: owner full control; partner may read categories that
-- contain at least one shared tracker (needed to render group headers)
create policy "own categories" on public.tracker_categories
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "partner reads shared categories" on public.tracker_categories
  for select using (
    public.partner_can_view(user_id, 'share_logs')
    and exists (
      select 1 from public.trackers t
      where t.category_id = tracker_categories.id and t.shared_with_partner
    )
  );

-- trackers: owner full control; partner reads shared tracker definitions
create policy "own trackers" on public.trackers
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "partner reads shared trackers" on public.trackers
  for select using (
    public.partner_can_view(user_id, 'share_logs') and shared_with_partner
  );

-- log_entries: owner full control; partner reads entries of shared trackers
-- (free-text trackers additionally require share_notes)
create policy "own log entries" on public.log_entries
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "partner reads shared logs" on public.log_entries
  for select using (
    public.partner_can_view(user_id, 'share_logs')
    and exists (
      select 1 from public.trackers t
      where t.id = log_entries.tracker_id
        and t.shared_with_partner
        and (t.input_type <> 'text' or public.partner_can_view(log_entries.user_id, 'share_notes'))
    )
  );

-- cycle_stats: owner full control; partner reads when phase sharing is on
create policy "own cycle stats" on public.cycle_stats
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "partner reads cycle stats" on public.cycle_stats
  for select using (public.partner_can_view(user_id, 'share_phase'));

-- reminders: owner only
create policy "own reminders" on public.reminders
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============================================================ realtime

alter publication supabase_realtime add table public.cycle_stats;
alter publication supabase_realtime add table public.log_entries;
alter publication supabase_realtime add table public.partner_links;
