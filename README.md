# Restaurant Order Management System

A system that replaces paper tickets at a restaurant. Managers own the menu, waiters run orders
from the table to the kitchen and back.

## Stack

| Layer | What's used | Why |
|-------|-------------|-----|
| Frontend | React (via Vite) + Tailwind CSS + React Router + TanStack Query | Vite gives a fast dev loop, Tailwind keeps styling quick without writing a bunch of CSS files, React Router handles pages/redirects, TanStack Query handles the "who's logged in" state and request caching so loading/error states aren't hand-rolled everywhere. |
| Backend | Node.js + Express | Small, plain, no extra framework magic easy to reason about for an API this size. |
| Database | Postgres (hosted on Supabase), through Prisma | No need to run/manage a Postgres server directly, and Prisma gives migrations plus a typed query client instead of writing raw SQL by hand. |
| Hosting | Client on Vercel, server on Render, both against the real Supabase database | See "Deploying" below client and server are on different domains, which needs a few things set up correctly. |

## Running it locally

```bash
# server
cd server
npm install
# fill in server/.env using server/.env.example as a guide
npm run migrate
npm run dev

# client (separate terminal)
cd client
npm install
npm run dev
```

Client runs on `http://localhost:5173`, server on `http://localhost:4000`.

## Deploying

Client → Vercel, server → Render but the browser only ever talks to the Vercel domain.
`client/api/proxy.js` is a Vercel Serverless Function that forwards every `/api/*` request to the
deployed Render URL, so from the browser's point of view every request (including login) is
same-origin. That matters: a genuinely cross-site request (the client calling the Render URL
directly) makes the login cookie a third-party cookie, which Incognito/private browsing blocks
outright login looks like it works, then every request after that comes back 401 because the
cookie was never actually stored. `client/vercel.json` rewrites `/api/(.*)` to the internal path
`/api/proxy?path=$1`, which the function reads back out. Two simpler versions of this were tried
first and didn't survive contact with production see `docs/decisions.md` and
`docs/architecture.md` for what went wrong with each.

1. On Render (server), run migrations with `npm run migrate:deploy` (`prisma generate` +
   `prisma migrate deploy`) before starting the server never `npm run migrate`
   (`prisma migrate dev`) in production.
2. On Render, set `CLIENT_ORIGIN` to the exact deployed Vercel URL, and make sure `NODE_ENV` is
   `production` (Render sets this by default).
3. On Vercel, set `API_ORIGIN` (a plain environment variable, **not** `VITE_`-prefixed see
   `client/.env.example`) to your actual deployed Render URL, e.g. `https://your-app.onrender.com`.
4. Leave `VITE_API_BASE_URL` **unset** on Vercel the client defaults to the relative `/api` path,
   which the proxy function handles. Only set it if you're intentionally accepting the direct
   cross-origin tradeoff described in `client/.env.example`.

## Demo credentials

| Role    | Email                 | Password    |
|---------|-----------------------|-------------|
| Manager | amit.singh@test.com   | password123 |
| Waiter  | priya.sharma@test.com | password123 |
| Waiter  | rahul.verma@test.com  | password123 |
| Waiter  | sara.khan@test.com    | password123 |

No demo admin account is published here that tier is one preserved real account, and its password
isn't something to put in a shared document. Log in with your own admin account, or have the admin
create a manager (or a manager create a waiter) via Team → Add account.

**First request after a while may be slow.** Both the client and server run on free hosting tiers,
and the server (Render) spins down after a period of no traffic the first request after that wakes
it back up, which can take a while before it responds. This is a hosting-tier thing, not a bug; it
only affects the very first request after the app's been idle.

## What's built

Organized around the ten goals in the brief. See `docs/plan.md` for build order and
`docs/decisions.md` for why specific things were built the way they were.

| # | Goal | Status | Notes |
|---|------|--------|-------|
| 1 | Accounts and roles | Done | Register/login/logout, role checked on the server not just hidden in the UI. Tightened twice after launch: a security audit found anyone could self-register as a manager, closed by removing public registration entirely and adding a third `admin` role a manager can create waiter accounts, only admin creates manager accounts or changes anyone's role, and admin itself is never assignable through the API. Password reset follows the same authority rule, since there's no email system to send a reset link. Removing a staff member is a deactivation, not a delete a real delete is rejected by the database itself once someone has order history. |
| 2 | Orders | Done | A waiter creates an order for a table and becomes its primary waiter. A manager-controlled table list replaced free-typed table numbers, so a waiter can only pick a table that actually exists and isn't already occupied checked on the server, not just enforced by what the picker shows. A race condition where two requests could double-book the same table was found and closed with a database-level transaction. |
| 3 | Order lines | Done | Adding an item to an order works out a running total on the server, using exact (not floating-point) math. Each line remembers the price at the moment it was added, not whatever the menu item costs now, so a later price change doesn't rewrite old orders. An order can't be created empty it needs at least one item, created atomically with it. |
| 4 | The lifecycle | Done | placed → accepted → preparing → ready → served, one step at a time, no skipping or going backwards. Cancelling only works before preparing starts. Any single item can be voided with a required reason, for as long as the order is still open. All of this is checked on the server, with a clear message when a move isn't allowed. |
| 5 | Collaborators | Done | An order still has exactly one primary waiter, but any number of other waiters can be added as collaborators and do everything the primary waiter can. Whether a given user can touch a given order comes down to one shared check reused everywhere, not copy-pasted per route. Waiters get a "my orders" list of everything they're primary or a collaborator on. |
| 6 | Finding orders | Done | Server-side search (table number), filters (status/waiter/date), sorting, and pagination with a real total count nothing fetched into the browser to filter there. A visibility gap from an earlier task was closed here too: the list only shows a waiter what they're actually allowed to see. |
| 7 | Bulk actions and CSV export | Done | A manager can apply a price/availability change to several menu items at once, with a per-item pass/fail report instead of an all-or-nothing failure. A day's orders can be exported as CSV, respecting the same visibility as everywhere else. A CSV-formula-injection hole in the export was found and fixed (a name or void reason typed into the app could execute as a formula when the file's opened in Excel). |
| 8 | The dashboard | Done | One manager-facing screen: headline numbers, a status breakdown, a per-waiter leaderboard, top-selling items, a 14-day trend chart, and a recent-orders feed. Waiters get their own view instead of a blank page their own open-order worklist, oldest first. The whole app was also made responsive for phone/tablet/desktop as a separate pass across every page. |
| 9 | The audit timeline | Done | Every order keeps a permanent, append-only history every status change, every line added or voided (with reason), every note written in the same database transaction as the change itself. Nothing in the app can update or delete one of these rows once written, including a manager. |
| 10 | Slow-order alerts | Done | An order open too long without reaching Ready shows up in an alerts list with a nav badge; acknowledging clears it, and it reappears if the order is still stuck well past a second threshold. Follow-up passes added a "clear table" shortcut, a more urgent severity tier for orders far overdue, and a background sweep that auto-cancels a genuinely abandoned order which skips any order a human has already acknowledged, and notifies the responsible waiter by toast when it fires. |

## How much time did you actually spend?

Didn't track it with a stopwatch, so this is a rough shape, not an exact number. It took many
sessions over several days. Each of the ten goals got at least one full session. A few goals got
extra follow-up sessions on top of that (dashboard, alerts, staff accounts). There was also a full
security audit session, and a long deployment session at the end. Deployment took longer than any
single feature did.

## What would you do next, with another 12 hours?

Add rate limiting on login, since that gap is still open. Add basic logging on the server, so bugs
are easier to find without guessing. Move the slow-order alert check off a single background timer
so it can run safely on more than one server. And actually test what happens with a lot more data in
the database, instead of leaving that question open.

## What are you least happy with in this codebase, and why?

Getting login to work after deployment. It took four tries to get it working properly across two
different domains, and one of the failed tries never got a clear explanation for why it didn't work.
It just got replaced with something that did. The fix works and has been tested, but not knowing why
the other approach failed bothers me a little. Also not happy that the alert system still runs as
one background timer on one server, which works fine now but won't scale to more than one server.
