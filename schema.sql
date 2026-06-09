create table if not exists public.training_log_entries (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  sleep_hours numeric not null default 0,
  bedtime time,
  wake_time time,
  sleep_quality integer not null default 3 check (sleep_quality between 1 and 5),
  energy integer not null default 3 check (energy between 1 and 5),
  mood integer not null default 3 check (mood between 1 and 5),
  soreness integer not null default 2 check (soreness between 1 and 5),
  workout_type text not null default 'Rest',
  duration integer not null default 0,
  effort integer not null default 4 check (effort between 1 and 10),
  workout_notes text not null default '',
  daily_win text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.training_log_entries enable row level security;

drop policy if exists "Allow public read training log entries" on public.training_log_entries;
create policy "Allow public read training log entries"
  on public.training_log_entries
  for select
  to anon
  using (true);

drop policy if exists "Allow public insert training log entries" on public.training_log_entries;
create policy "Allow public insert training log entries"
  on public.training_log_entries
  for insert
  to anon
  with check (true);

drop policy if exists "Allow public update training log entries" on public.training_log_entries;
create policy "Allow public update training log entries"
  on public.training_log_entries
  for update
  to anon
  using (true)
  with check (true);

drop policy if exists "Allow public delete training log entries" on public.training_log_entries;
create policy "Allow public delete training log entries"
  on public.training_log_entries
  for delete
  to anon
  using (true);
