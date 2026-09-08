-- Run this in the Supabase SQL Editor AFTER schema.sql and
-- schema_v2_additions.sql.
--
-- This aligns the form with your actual OCC shift handover document and
-- adds a real audit trail: handovers become editable, and every edit
-- (including signing off) is recorded as a full before/after snapshot in
-- handover_revisions, attributed to whoever made the change.
--
-- Existing columns are left in place (not dropped) so nothing already
-- filed is lost — older entries just won't have these new fields filled
-- in, and the app treats that as "not recorded" rather than an error.

alter table handovers add column if not exists shift_change_time text;
alter table handovers add column if not exists mel_items text;
alter table handovers add column if not exists weather_info text;
alter table handovers add column if not exists navaid_restrictions text;
alter table handovers add column if not exists atc_restrictions text;
alter table handovers add column if not exists route_change_notices text;
alter table handovers add column if not exists fps_issues jsonb not null default '[]'::jsonb;
alter table handovers add column if not exists diversions text;
alter table handovers add column if not exists payload_restriction text;
alter table handovers add column if not exists other_info text;
alter table handovers add column if not exists erp_issue text;
alter table handovers add column if not exists erp_revision_no text;
alter table handovers add column if not exists erp_date date;
alter table handovers add column if not exists erp_copy_type text; -- 'paper' | 'digital' | 'both'
alter table handovers add column if not exists incoming_signoffs jsonb not null default '[]'::jsonb;
alter table handovers add column if not exists outgoing_signoffs jsonb not null default '[]'::jsonb;
alter table handovers add column if not exists head_signoffs jsonb not null default '[]'::jsonb;
alter table handovers add column if not exists updated_at timestamptz;
alter table handovers add column if not exists updated_by_name text;

-- Previously handovers were insert-only. Corrections and sign-offs both
-- need to update an existing row, so allow updates from any signed-in
-- operator (same trust model as the rest of the app) — every update is
-- paired with a revision row by the application, giving you the "who
-- changed what" record.
drop policy if exists "Signed-in users can update handovers" on handovers;
create policy "Signed-in users can update handovers"
  on handovers for update
  to authenticated
  using (true)
  with check (true);

create table if not exists handover_revisions (
  id uuid primary key default gen_random_uuid(),
  handover_id uuid references handovers(id) not null,
  editor_id uuid references auth.users(id) not null,
  editor_name text not null,
  edited_at timestamptz not null default now(),
  previous_data jsonb not null,
  new_data jsonb not null
);

alter table handover_revisions enable row level security;

create policy "Signed-in users can read all revisions"
  on handover_revisions for select
  to authenticated
  using (true);

create policy "Signed-in users can insert their own revisions"
  on handover_revisions for insert
  to authenticated
  with check (auth.uid() = editor_id);
