-- Run this once in your Supabase project's SQL Editor.
-- Creates the handovers table and locks it down so only signed-in
-- operators can read or write, and everyone can only file entries
-- under their own account.

create table if not exists handovers (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references auth.users(id) not null,
  author_name text not null,
  shift text not null,
  date date not null,
  handed_to text,
  system_status jsonb not null default '{}'::jsonb,
  summary text,
  open_items text,
  notes text,
  created_at timestamptz not null default now()
);

alter table handovers enable row level security;

-- Any signed-in operator can read every handover (that's the point
-- of a shared log).
create policy "Signed-in users can read all handovers"
  on handovers for select
  to authenticated
  using (true);

-- Operators can only file entries attributed to themselves.
create policy "Signed-in users can insert their own handovers"
  on handovers for insert
  to authenticated
  with check (auth.uid() = author_id);

-- Entries are append-only by design (a real shift log shouldn't be
-- editable after the fact). If you later want authors to correct
-- their own recent entries, add an update policy here.
