-- Apply ONLY to the dedicated "8aPDF Calendar" Supabase project.
-- The public website can read dates; only the server-side Edge Function writes them.
create table if not exists public.calendar_state (
  key text primary key check (key = 'current'),
  config jsonb not null,
  source_revision text not null,
  published_at timestamptz not null default now()
);
create table if not exists public.calendar_days (
  date date primary key,
  school_day smallint check (school_day between 1 and 6),
  holiday boolean not null,
  reason text not null default '',
  next_date date not null,
  next_day smallint not null check (next_day between 1 and 6),
  published_at timestamptz not null default now(),
  constraint off_day_has_no_school_day check ((holiday and school_day is null) or (not holiday and school_day is not null))
);
create index if not exists calendar_days_next_date_idx on public.calendar_days (next_date);
alter table public.calendar_state enable row level security;
alter table public.calendar_days enable row level security;
revoke all on table public.calendar_state,public.calendar_days from anon,authenticated;
grant select on table public.calendar_state,public.calendar_days to anon,authenticated;
grant select,insert,update,delete on table public.calendar_state,public.calendar_days to service_role;
create policy "Read authoritative school calendar" on public.calendar_state
  for select to anon,authenticated using (true);
create policy "Read verified calendar days" on public.calendar_days
  for select to anon,authenticated using (true);
-- No public INSERT, UPDATE, or DELETE policies, even for logged-in users.
