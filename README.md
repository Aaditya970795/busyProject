# Restaurant Order Management System

A system to replace paper tickets at a restaurant. Managers own the menu, waiters run orders from
the table to the kitchen and back. Still early — more gets added task by task (see `docs/plan.md`
for the build order).

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

## Demo credentials

| Role    | Email                     | Password      |
|---------|----------------------------|----------------|
| Manager | alice.manager@test.com    | password123    |
| Waiter  | bob.waiter@test.com       | password123    |

These were created while testing Task 1 and already exist in the database — just log in with them.

## Stack

| Layer    | What I used                                              | Why |
|----------|-----------------------------------------------------------|-----|
| Frontend | React (via Vite) + Tailwind CSS + React Router + TanStack Query | Vite gives a fast dev loop, Tailwind keeps styling quick without writing a bunch of CSS files, React Router handles pages/redirects, TanStack Query handles the "who's logged in" state and request caching so I'm not hand-rolling loading/error states everywhere. |
| Backend  | Node.js + Express                                          | Small, plain, no extra framework magic — easy to reason about for an API this size. |
| Database | Postgres (hosted on Supabase), through Prisma              | Didn't want to run/manage my own Postgres server, and Prisma gives migrations plus a typed query client instead of writing raw SQL by hand. |
| Hosting  | Not deployed anywhere yet — running locally against the real Supabase database | [YOU: fill in once this actually gets deployed somewhere] |

## Goal checklist

Mark each honestly. Partial is fine — say what is partial.

| # | Goal | Status | Notes |
|---|------|--------|-------|
| 1 | Project setup, database, and login system (register/login/logout, role-based access) | Done | Registered a manager and a waiter, logged in as both, checked the role comes back right, checked logged-out users get rejected — all actually tested, not just built. |
| 2 | Menu management (manager-only CRUD + archive) and orders/order lines with a server-computed total | Done | Created menu items as a manager, confirmed a waiter gets 403 trying to create one, created an order as a waiter, added two lines, and confirmed the running total came back exactly right ($33.48 for 2×$9.99 + 3×$4.50). No status-transition rules or voiding yet — that's a later task on purpose. |
| 3 | Order status rules (placed → accepted → preparing → ready → served, plus cancelling and voiding a single item) | Done | Tried every wrong move I could think of first — skipping a step, going backwards, cancelling once the kitchen had started, voiding an item on a finished order, voiding with no reason — and each one got rejected with a clear message saying why. Then walked one order through the full path to served and checked the total updated correctly along the way. |
| 4 | Order collaborators + tightened permissions (only the primary waiter, a manager, or an added collaborator can act on an order) | Done | Created an order as waiter A, confirmed waiter B — not attached to it at all — got rejected on every single mutating action (add line, void line, change status, archive, delete), added waiter B as a collaborator, confirmed all of those started working for them, confirmed a manager could act on it regardless of collaborator status, and confirmed waiter B's "my orders" list picked the order up. |
| 5 | Table management (manager builds/removes the table list, waiters can only pick a free table instead of typing a number, with search) | Done | Created five tables as a manager, confirmed a waiter got rejected trying to create one, confirmed a duplicate table number got rejected, opened an order on a free table and watched it disappear from the available list immediately, confirmed trying to open a second order on that same table got rejected, archived and restored a table, confirmed cancelling the order freed the table back up, and re-checked menu CRUD/status transitions/collaborator permissions still worked afterward. |
| 6 | Order list search/filter/sort/pagination, all server-side, respecting who's allowed to see which orders | Done | Seeded over a dozen orders across two waiters and a manager with different tables/statuses/dates, ran a combined search+status filter+sort+page-2 request and confirmed the exact expected slice and total count came back, confirmed a waiter's results never included an order they had no relationship to even when they explicitly filtered for it (e.g. filtering by another waiter's id only surfaced the one order actually shared between them), and confirmed bad query params (invalid sort/dir/status/date/page) were all rejected with a clear 400. |
| 7 | Bulk menu item updates (price/availability, per-item pass/fail) + CSV export of a day's orders | Done | Bulk-updated a mix of valid ids, a nonexistent one, and a negative-price attempt in one request and got a clean per-item `ok`/`rejected` result back instead of an all-or-nothing failure; exported a real day's orders to CSV and checked the totals in it against what `GET /orders/:id` reported for the same orders — matched exactly. Also caught and fixed a CSV-formula-injection hole in the export (a waiter's own name or a void reason could execute as a formula when opened in Excel) with a real `=HYPERLINK(...)` payload proving the fix. |
| 8 | Full security audit of the whole project + fixes | Done | Found and fixed: an order could be created with zero items (now atomic, requires one); anyone could self-register as a manager (the headline finding); four missing database indexes on columns the app actually filters by; `GET /orders/:id` was missing the visibility check every other order endpoint has; a table could be double-booked by two concurrent requests (closed with a real Serializable-transaction race test, not just reasoning about it); and every waiter could see every coworker's email. Also caught, while fixing the first item, that a demoted user's existing login cookie kept their old access for up to 7 days — fixed the same session. |
| 9 | No more public registration — a real admin/manager/waiter hierarchy for creating accounts | Done | Confirmed the old `/register` endpoint is gone (404); admin creates a manager account directly and it can log in and use manager powers immediately; a manager creating another manager gets rejected with a clear 403; that same manager creating a waiter succeeds; a plain waiter is blocked from creating any account; only admin can change anyone's role, including being unable to touch admin's own role through the API at all — the one account created by a one-time script instead. |
| 10 | Password reset (no email infra, so it's authority-based) + a create-account success screen | Done | Manager resets a waiter's password and the old one stops working immediately while the new one logs in; manager blocked from resetting another manager's or admin's password; admin blocked from resetting even their own. Opened an actual browser, created an account, confirmed the password shows once in a copyable card after success instead of vanishing, clicked "Copy," and pasted the clipboard into another field to confirm it held the exact password. |
| 11 | Manager dashboard (headline stats, status/waiter/top-seller breakdowns, a 14-day trend chart) + a real waiter-facing view instead of a locked-out page | Done | Checked the headline stat cards, status breakdown, and top-seller list against the actual order data underneath them; toggled the 14-day chart between orders-served and revenue; logged in as a waiter and confirmed they see their own open-order worklist (oldest first) instead of the manager view, sourced from the same `/orders/mine` endpoint Task 4 already built. |
| 12 | Fully responsive UI across phone/tablet/desktop | Done | Audited every page for fixed-width overflow, rewrote the nav bar into a hamburger drawer below the `md` breakpoint, wrapped every data table in horizontal scroll, and fixed header/form wrapping. Verified in a real browser at phone (390px) and tablet (~768-800px) widths — nav collapses/expands correctly, every table scrolls instead of breaking layout, and a real bug (a form field getting squeezed instead of stacking on narrow screens) was caught and fixed during that verification, not just by reading the code. |
| 13 | Order audit timeline (status changes, line adds/voids, notes) that nothing — including a manager — can edit or delete afterward | Done | Created a real order, added a line, voided a line, walked it through every status to served, and left a note, then pulled its timeline and confirmed all eight events came back in the right order with the right actor and detail; confirmed no code path anywhere calls `.update`/`.delete` on an event row. Also switched the dashboard's "served today" and 14-day trend from an `updatedAt` approximation to the order's real served-at event, and confirmed the numbers matched that one order exactly (voided line correctly excluded from revenue). |
| 14 | Slow-order alerts (nav badge + list, acknowledge/reappear, env-configurable thresholds) | Done | Backdated a real test order's `createdAt` past the threshold and confirmed it appeared in `GET /api/alerts`; confirmed a second order that reached Ready in time never appeared at all; acknowledged the first and confirmed it disappeared immediately; backdated its acknowledgement past the reappear window and confirmed it came back. Confirmed a waiter's alert list only shows their own orders and a waiter gets a 403 acknowledging someone else's. Deliberately left off the audit timeline — see `docs/decisions.md` #53. Follow-up pass added a "Clear table" action (reuses the Task 3 cancel rule, verified rejected on a `preparing` order and accepted on a `placed` one, freeing the table and logging to the Task 13 timeline for free), a critical severity tier past a second threshold, and tracking of who acknowledged each alert, verified end-to-end including the "repeat alert" flag on one that came back after being acknowledged once. A second follow-up fixed raw-minutes durations (`2814m` → `1d 22h`) and added a once-a-minute background sweep that auto-cancels any placed/accepted order left open past 45 minutes, freeing its table with no human action; verified it correctly skipped a `preparing` order while cancelling a `placed` one (and, running it for real, also cleared four genuinely stale orders left over from much earlier testing). |

## How much time did you actually spend?


## What would you do next, with another 12 hours?


## What are you least happy with in this codebase, and why?

