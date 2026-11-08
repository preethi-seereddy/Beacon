-- Beacon database schema for Supabase.
-- Run in the Supabase SQL editor. The web app and the Photon/Beau messaging
-- backend both read and write these tables, so the map and iMessage stay in sync.

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

create policy "reports readable" on public.reports for select using (true);
create policy "reports insertable" on public.reports for insert with check (true);
create policy "reports resolvable" on public.reports for update using (true) with check (true);

create policy "votes readable" on public.report_votes for select using (true);
create policy "votes insertable" on public.report_votes for insert with check (true);
create policy "votes changeable" on public.report_votes for update using (true) with check (true);

-- Photos: create a public storage bucket named "report-photos" in the dashboard,
-- or run:
insert into storage.buckets (id, name, public) values ('report-photos', 'report-photos', true)
on conflict (id) do nothing;
create policy "photos readable" on storage.objects for select using (bucket_id = 'report-photos');
create policy "photos uploadable" on storage.objects for insert with check (bucket_id = 'report-photos');
