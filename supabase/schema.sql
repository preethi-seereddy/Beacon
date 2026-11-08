-- Beacon database schema for Supabase.
-- Run in the Supabase SQL editor (safe to re-run). The web app and Beau, the
-- Photon iMessage agent in agent/, both read and write these tables, so the map
-- and iMessage stay in sync.

create extension if not exists pgcrypto;

create table if not exists public.reports (
  id             uuid primary key default gen_random_uuid(),
  category       text not null check (category in
                   ('broken_elevator','blocked_ramp','stairs_path','construction','blocked_entrance','other')),
  lat            double precision not null,
  lng            double precision not null,
  edge_id        text,            -- nearest walkway in src/lib/campus.ts; routing avoids it
  location_label text not null,
  description    text default '',
  photo_url      text,
  reporter_id    text,            -- anonymous device id, or the Beau user id
  source         text not null default 'app' check (source in ('app','beau')),
  created_at     timestamptz not null default now(),
  resolved_at    timestamptz
);

create table if not exists public.report_votes (
  report_id  uuid not null references public.reports(id) on delete cascade,
  voter_id   text not null,
  vote       text not null check (vote in ('confirm','dispute')),
  created_at timestamptz not null default now(),
  primary key (report_id, voter_id)
);

create or replace view public.reports_with_counts as
select r.*,
       count(v.*) filter (where v.vote = 'confirm') as confirmations,
       count(v.*) filter (where v.vote = 'dispute') as disputes
from public.reports r
left join public.report_votes v on v.report_id = r.id
group by r.id;

create index if not exists reports_created_idx on public.reports (created_at desc);

-- Row Level Security: open read, anonymous insert. Fine for a hackathon demo;
-- tighten (e.g. require auth, rate-limit) before real use.
alter table public.reports enable row level security;
alter table public.report_votes enable row level security;

drop policy if exists "reports readable" on public.reports;
create policy "reports readable" on public.reports for select using (true);
drop policy if exists "reports insertable" on public.reports;
create policy "reports insertable" on public.reports for insert with check (true);
drop policy if exists "reports resolvable" on public.reports;
create policy "reports resolvable" on public.reports for update using (true) with check (true);

drop policy if exists "votes readable" on public.report_votes;
create policy "votes readable" on public.report_votes for select using (true);
drop policy if exists "votes insertable" on public.report_votes;
create policy "votes insertable" on public.report_votes for insert with check (true);
drop policy if exists "votes changeable" on public.report_votes;
create policy "votes changeable" on public.report_votes for update using (true) with check (true);

-- Photos: create a public storage bucket named "report-photos" in the dashboard,
-- or run:
insert into storage.buckets (id, name, public) values ('report-photos', 'report-photos', true)
on conflict (id) do nothing;
drop policy if exists "photos readable" on storage.objects;
create policy "photos readable" on storage.objects for select using (bucket_id = 'report-photos');
drop policy if exists "photos uploadable" on storage.objects;
create policy "photos uploadable" on storage.objects for insert with check (bucket_id = 'report-photos');

-- ---------------------------------------------------------------------------
-- Beau (agent/): people who texted Beau, and the "is it still there?" questions
-- Beau asks them. No anon policies on purpose: these hold phone numbers / chat
-- ids. RLS with no policies = the public web key can't read them. Beau's server
-- uses SUPABASE_SERVICE_ROLE_KEY (server-only), which bypasses RLS.
-- ---------------------------------------------------------------------------
create table if not exists public.subscribers (
  id            uuid primary key default gen_random_uuid(),
  platform      text not null,
  handle        text not null,
  space_id      text not null,
  agent_user_id text not null,
  saved_from    text,              -- start node id (src/lib/campus.ts)
  saved_to      text,              -- destination building id
  alerts        boolean not null default true,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  unique (platform, handle)
);
alter table public.subscribers enable row level security;

create table if not exists public.verification_asks (
  id            uuid primary key default gen_random_uuid(),
  report_id     uuid not null references public.reports(id) on delete cascade,
  subscriber_id uuid not null references public.subscribers(id) on delete cascade,
  asked_at      timestamptz default now(),
  answer        text check (answer in ('yes','no')),
  answered_at   timestamptz
);
alter table public.verification_asks enable row level security;

-- ---------------------------------------------------------------------------
-- Realtime: the website listens for report and vote changes, so a report texted
-- to Beau shows up on the map without a refresh.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'reports') then
    alter publication supabase_realtime add table public.reports;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'report_votes') then
    alter publication supabase_realtime add table public.report_votes;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Points & leaderboard. Rewards verified, useful contributions, not volume:
--   +10 per report of yours that someone else confirmed (and isn't disputed down)
--   +5  bonus when that report is later marked fixed
--   +2  per confirm/dispute you give
-- Keep in sync with POINTS in src/lib/data.ts.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id           text primary key,   -- the web app's anonymous device id
  display_name text not null,
  updated_at   timestamptz default now()
);
alter table public.profiles enable row level security;
drop policy if exists "profiles readable" on public.profiles;
create policy "profiles readable" on public.profiles for select using (true);
drop policy if exists "profiles writable" on public.profiles;
create policy "profiles writable" on public.profiles for insert with check (true);
drop policy if exists "profiles updatable" on public.profiles;
create policy "profiles updatable" on public.profiles for update using (true) with check (true);

create or replace view public.leaderboard as
with rep as (
  select reporter_id as uid,
         count(*) filter (where confirmations > 0 and confirmations > disputes)                            as verified_reports,
         count(*) filter (where confirmations > 0 and confirmations > disputes and resolved_at is not null) as resolved_reports
  from public.reports_with_counts
  where reporter_id is not null
  group by reporter_id
),
votes as (
  select voter_id as uid, count(*) as checks
  from public.report_votes
  group by voter_id
),
everyone as (
  select uid from rep union select uid from votes
)
select e.uid,
       coalesce(p.display_name, case when e.uid like 'beau:%' then 'Beau texter' else 'Anonymous' end) as name,
       coalesce(rep.verified_reports, 0) * 10 + coalesce(rep.resolved_reports, 0) * 5 + coalesce(votes.checks, 0) * 2 as points,
       coalesce(rep.verified_reports, 0) as verified_reports,
       coalesce(votes.checks, 0)         as checks
from everyone e
left join rep      on rep.uid = e.uid
left join votes    on votes.uid = e.uid
left join public.profiles p on p.id = e.uid
order by points desc;
