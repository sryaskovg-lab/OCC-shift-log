# OCC Shift Log

A shared shift-handover log with real accounts. Every operator signs in with
their own email and password; every handover they file is visible to everyone
else who signs in.

Two free services do the heavy lifting:
- **Supabase** — the database and the real login system (passwords are
  hashed and handled by Supabase, never by this code).
- **Vercel** — hosts the app itself and gives you the URL your team visits
  every day.

Total one-time setup: about 15 minutes, no coding required.

## 1. Create the database (Supabase)

1. Go to https://supabase.com and create a free account, then **New project**.
   Pick any name and a strong database password (you won't need this
   password day-to-day).
2. Once the project is ready, open **SQL Editor** in the left sidebar and
   run these three files, in order, from the `supabase/` folder:
   1. `schema.sql`
   2. `schema_v2_additions.sql`
   3. `schema_v3_additions.sql` — adds the OCC-specific fields (MEL,
      weather, NAVAID/ATC restrictions, Flight Planning System issues,
      diversions, payload restriction, ERP revision check), the
      incoming/outgoing/Head-of-OCC sign-off blocks, and the audit trail
      table that logs every edit.
3. Open **Settings → API**. You'll need two values from this page in step 3:
   - **Project URL**
   - **anon public** key

Optional but recommended for a closed team: in **Authentication → Providers
→ Email**, you can leave "Confirm email" on (operators verify their email
once when they sign up) or turn it off if you'd rather they get in
immediately. Either is fine for 30 known people.

## 2. Put this code on GitHub

Vercel deploys from a GitHub repository.

1. Create a new empty repository on https://github.com (e.g. `occ-shift-log`).
2. From inside this folder, run:
   ```
   git init
   git add .
   git commit -m "OCC shift log"
   git branch -M main
   git remote add origin <your new repo's URL>
   git push -u origin main
   ```

## 3. Deploy (Vercel)

1. Go to https://vercel.com, sign up (you can use your GitHub account), and
   click **Add New → Project**.
2. Import the repository you just pushed.
3. Before clicking Deploy, open **Environment Variables** and add:
   - `NEXT_PUBLIC_SUPABASE_URL` → the Project URL from step 1
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → the anon public key from step 1
4. Click **Deploy**. After a minute you'll get a live URL like
   `occ-shift-log.vercel.app`.

That URL is what you share with your 30 operators.

## 4. Get your team on it

Send everyone the Vercel URL. Each person opens it, clicks **Create an
account**, enters their name, work email, and a password. From then on they
just sign in.

There's no admin step to pre-create 30 accounts — each operator creates
their own the first time, the same way they would for any internal tool.

## Day-to-day use

- **New handover** files a shift entry matching your OCC form: shift,
  date, time of shift change, who it's handed to, priority, MEL items,
  weather at home base/destinations/alternates, NAVAID and ATC
  restrictions, route change notices, Flight Planning System issues (each
  with description, time occurred, time reported, who it was reported to,
  and IT ticket number), diversion details, payload/baggage restrictions,
  other relevant info, the ERP revision check (issue, revision, date, and
  whether the copy is paper or digital), an optional attachment link, and
  notes.
- **Editing**: click "Edit" on any entry to correct it. Every edit is
  recorded — who made it, when, and exactly which fields changed from what
  to what — visible under "Show edit history" at the bottom of the entry.
  Nothing is ever silently overwritten.
- **Sign-off**: incoming shift, outgoing shift, and Head of OCC each get
  their own block where anyone signed in can click "Sign as..." to add
  their name and timestamp — the digital equivalent of the paper form's
  print-and-sign lines. Multiple people can sign each block. Signing is
  itself logged in the same edit history as a change to that entry.
- The left-hand timeline shows every past entry, newest first, with a
  priority pill on elevated/critical entries, a "For you" pill when it's
  addressed to you and nobody has responded yet, a reply count once
  someone has, and an "Edited" pill once it's been corrected.
- **Responses**: anyone signed in can post a follow-up note at the bottom
  of an entry — a lighter-weight way to acknowledge or ask a question
  without opening a full edit.

Entries filed before this update (with the old generic system-status
board, summary, and open-items fields) still show that data under a
"Legacy fields" note at the bottom of the entry — nothing was deleted when
the form changed, it's just not collected on new entries anymore.

Note on "handed to" and signing: since operators sign up with their own
names rather than picking from a fixed list, "handed to" is free text and
the "For you" tag is a soft match against your account name — it doesn't
lock anyone out. The same is true of editing and signing: any signed-in
operator can edit or sign any entry. That's a deliberate trade-off for
simplicity; the audit trail is what keeps it accountable rather than
locking people out of each other's entries. If you'd rather restrict
editing to the original author or the person it's handed to, that's a
follow-on change to the database policy in `schema_v3_additions.sql`.

## Local development (optional)

If you want to run it on your own machine before deploying:

```
npm install
cp .env.local.example .env.local   # then fill in your Supabase values
npm run dev
```

Visit http://localhost:3000.

## What this does and doesn't cover

- Real per-person accounts and password security: yes, handled by Supabase.
- Data survives restarts, is backed up, and scales past 30 users without
  any changes: yes, it's a real Postgres database.
- Company SSO (Google/Microsoft login instead of a password): not wired up
  by default since you're not on either — Supabase supports adding it later
  if that changes.
- Editing or deleting past entries, and an audit trail of who changed what:
  not included — the log is append-only by design. Ask if you want this
  added.
