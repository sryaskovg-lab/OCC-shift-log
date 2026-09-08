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
2. Once the project is ready, open **SQL Editor** in the left sidebar, paste
   in the contents of `supabase/schema.sql` from this folder, and click
   **Run**. This creates the `handovers` table and locks it down so only
   signed-in operators can read or write it.
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

- **New handover** files a shift entry: shift, date, who it's handed to, a
  quick status board for Network/Power/Comms/Security (click a chip to
  cycle Normal → Degraded → Critical), a summary, open items, and notes for
  the next shift.
- The left-hand timeline shows every past entry, newest first, with colored
  dots showing that entry's system status at a glance.
- Entries are append-only — once filed, a handover stands as the record of
  what that shift reported. If you want editing or a formal correction
  workflow later, that's a small addition to the database policy in
  `supabase/schema.sql`.

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
