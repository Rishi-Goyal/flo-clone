-- Security hardening: enforce the prediction-sharing flags in the database.
--
-- Previously the partner could SELECT the whole cycle_stats row whenever
-- share_phase was on, so share_predictions / share_period_dates were only
-- enforced by the UI. Partners now read through get_partner_stats(), which
-- filters fields by the owner's sharing flags. Run after 002.

-- partners no longer read the table directly
drop policy if exists "partner reads cycle stats" on public.cycle_stats;

-- realtime replacement: a cycle_stats write "pings" the owner's active link
-- row (which the partner CAN see), so the partner app knows to refetch.
alter table public.partner_links add column if not exists stats_updated_at timestamptz;

create or replace function public.ping_partner_on_stats()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  update public.partner_links
  set stats_updated_at = now()
  where owner_id = new.user_id and status = 'active';
  return new;
end;
$$;

drop trigger if exists cycle_stats_ping on public.cycle_stats;
create trigger cycle_stats_ping
  after insert or update on public.cycle_stats
  for each row execute function public.ping_partner_on_stats();

-- Flag-filtered partner read. Day-dependent values are computed here (in the
-- owner's timezone) so hidden dates never need to leave the database.
create or replace function public.get_partner_stats()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  l public.partner_links%rowtype;
  s public.cycle_stats%rowtype;
  today date;
  v_cycle_day int;
  v_days_until int;
  v_days_late int := 0;
  v_phase text;
  dist int;
  result jsonb;
begin
  select * into l
  from public.partner_links
  where partner_id = auth.uid() and status = 'active'
  limit 1;
  if not found or not l.share_phase then
    return null;
  end if;

  select * into s from public.cycle_stats where user_id = l.owner_id;
  if not found or s.last_period_start is null then
    return jsonb_build_object('phase', null);
  end if;

  select (now() at time zone coalesce(p.timezone, 'UTC'))::date
  into today
  from public.profiles p
  where p.id = l.owner_id;

  v_cycle_day := today - s.last_period_start + 1;
  if s.predicted_next_start is not null then
    v_days_until := s.predicted_next_start - today;
    v_days_late := greatest(0, -v_days_until - coalesce(s.prediction_window_days, 4));
  end if;

  if v_cycle_day <= round(coalesce(s.avg_period_length, 5)) then
    v_phase := 'menstrual';
  elsif s.ovulation_date is not null then
    dist := today - s.ovulation_date;
    if dist between -1 and 1 then v_phase := 'ovulation';
    elsif dist < -1 then v_phase := 'follicular';
    else v_phase := 'luteal';
    end if;
  else
    v_phase := 'follicular';
  end if;

  result := jsonb_build_object(
    'phase', v_phase,
    'cycle_day', v_cycle_day,
    'confidence', s.confidence,
    'days_late', v_days_late
  );

  if l.share_predictions and v_days_until is not null then
    result := result || jsonb_build_object(
      'days_until', v_days_until,
      'window_days', coalesce(s.prediction_window_days, 4)
    );
    if l.share_period_dates then
      result := result || jsonb_build_object('predicted_next_start', s.predicted_next_start);
    end if;
  end if;

  return result;
end;
$$;

revoke execute on function public.get_partner_stats() from anon, public;
grant execute on function public.get_partner_stats() to authenticated;
