-- Device push tokens (FCM) for note notifications. Run after 003.

create table public.push_tokens (
  token text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform text not null default 'android',
  updated_at timestamptz not null default now()
);

alter table public.push_tokens enable row level security;

create policy "own tokens" on public.push_tokens
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
