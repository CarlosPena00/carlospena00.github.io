# Diagrama de investimentos — investment tool

Obs. NOQA project!

A personal portfolio-allocation tool (own version of the AUVP "Diagrama de investimentos").
Static front-end (vanilla JS, no build) hosted on GitHub Pages, using **Supabase**
(Auth + Postgres + RLS) as the backend-as-a-service. Code is in English; logic is
written as pure functions (KISS over OOP).

Live path: `https://<your-domain>/investment/`

## Phase status
- **Phase 1 (done)**: email+password login, portfolios, assets/targets/caps CRUD,
  current-allocation view.
- **Phase 2 (next)**: aporte (contribution) calculator in `js/allocation.js`.
- **Phase 3**: refinements (per-asset targeting, JSON import/export, polish).

## One-time Supabase setup
1. Create a free project at <https://supabase.com>.
2. **SQL editor** → paste and run [`schema.sql`](./schema.sql) (creates tables + RLS).
3. **Authentication → Providers → Email**: keep *Email* enabled. Login is by real
   email + password, so you can keep **"Confirm email" ON** — users click the link in
   the confirmation email before their first login.
4. **Authentication → URL Configuration**: set the **Site URL** to your site
   (custom domain or `https://carlospena00.github.io`). The confirmation link redirects
   here; afterwards open `/investment/` and log in.
5. **Project Settings → API**: copy the **Project URL** and the **anon public** key
   into [`config.js`](./config.js). (The anon key is public by design; RLS protects data.
   Never put the `service_role` key here.)

## Files
- `index.html` — app shell (no Jekyll front matter, served verbatim).
- `config.js` — Supabase URL + publishable (anon) key. Public by design; RLS protects data.
- `js/supabase.js` — Supabase client.
- `js/auth.js` — sign up / in / out (email + password).
- `js/db.js` — CRUD for portfolios, assets, targets, caps.
- `js/allocation.js` — pure functions + B3 sector/subsector data (`computeCurrent` now;
  aporte calc in Phase 2).
- `js/ui.js` — render helpers (HTML strings).
- `js/app.js` — state + event wiring.
- `styles.css` — self-contained styles.
- `schema.sql` — DB schema + RLS (run once in Supabase).

## Local preview
The static files are served by Jekyll. Run `jekyll build` (or `bundle exec jekyll serve`)
and open `/investment/`. The app needs a real Supabase project configured in `config.js`
to log in and read/write data.
