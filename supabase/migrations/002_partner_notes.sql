-- Partner notes: short messages between the two members of an active link
-- (e.g. the partner reacting to today's tip). Run after 001_init.sql.

create table public.partner_notes (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.partner_links (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index partner_notes_recipient on public.partner_notes (recipient_id, read_at);

alter table public.partner_notes enable row level security;

-- sender must be one member of the ACTIVE link, recipient the other
create policy "members send notes" on public.partner_notes
  for insert with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.partner_links l
      where l.id = link_id
        and l.status = 'active'
        and ((l.owner_id = sender_id and l.partner_id = recipient_id)
          or (l.partner_id = sender_id and l.owner_id = recipient_id))
    )
  );

create policy "members read their notes" on public.partner_notes
  for select using (auth.uid() in (sender_id, recipient_id));

-- recipient may only mark a note as read; nothing else changes
create policy "recipient marks read" on public.partner_notes
  for update using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

create or replace function public.guard_partner_note_update()
returns trigger language plpgsql as $$
begin
  if new.link_id <> old.link_id
     or new.sender_id <> old.sender_id
     or new.recipient_id <> old.recipient_id
     or new.body <> old.body
     or new.created_at <> old.created_at then
    raise exception 'Only read_at may be updated';
  end if;
  return new;
end;
$$;

create trigger partner_note_update_guard
  before update on public.partner_notes
  for each row execute function public.guard_partner_note_update();

alter publication supabase_realtime add table public.partner_notes;
