# Lulu

A calm, pastel, iPhone-style baby tracker (PWA): sleep first, then feeding, diapers, pumping and health.
English + Hebrew (RTL), light / dark / night mode, two parents sharing one live log.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
```

With no Supabase keys the app saves everything **on this device** (browser storage) — handy for trying it out.

## Turn on cloud sync (both parents, live)

1. Create a free project at https://supabase.com.
2. **SQL Editor → New query**, paste `supabase/schema.sql`, **Run**.
3. **Authentication → Sign In / Providers → Email**: keep it enabled.
   Optional but recommended for the home-screen app: **Authentication → Emails → Magic Link** template,
   add `Your code: {{ .Token }}` so you can type the 6-digit code instead of opening the link.
4. **Authentication → URL Configuration**: set *Site URL* to your site, e.g. `https://galantoren.github.io/lulu/`
   (and add `http://localhost:5173` under *Redirect URLs* for local dev).
5. **Project Settings → API**: copy the *Project URL* and the *anon public* key.
   - Local: copy `.env.example` to `.env.local` and fill both values.
   - GitHub: repo **Settings → Secrets and variables → Actions → New repository secret**:
     `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

The anon key is safe to ship in the website; Row Level Security in `schema.sql` keeps each family's data private.

## Publish on GitHub Pages

1. Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Merge to `main`. The workflow in `.github/workflows/deploy.yml` builds and publishes to
   `https://galantoren.github.io/lulu/`.
3. On iPhone open the link in Safari → Share → **Add to Home Screen**.

## Import history from Nara (or another tracker)

More → Profile → **Import history (CSV / Excel)**. Pick one or more `.csv` / `.xlsx` files exported from your old app.
Lulu guesses which column is the type, start/end time, duration, amount, side and notes (English or Hebrew headers),
shows a preview with counts per category, and lets you fix any column before importing. Importing the same file
again doesn't create duplicates.

## Branches

- `main` — what's live on the website.
- `claude/...` — work in progress; open a pull request into `main` to publish it.

## Roadmap

- Phase 1 (this): onboarding, family invite, Today tab (sleep card, one-tap timers, day ring, since-last cards, log), basic History / Health / More.
- Phase 2: richer History charts (feeds, diapers, pumping), food photo gallery.
- Phase 3: medicine schedules with minimum-interval alerts, temperature chart, WHO growth percentiles, doctor summary.
- Phase 4: milk stash, parent wellbeing.
- Phase 5: offline queue, accessibility pass, demo data.
