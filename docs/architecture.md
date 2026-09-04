# Architecture

## What this is

This is a restaurant order system that's replacing the old paper tickets. There are two kinds of
users — managers, who own the menu, and waiters, who take orders from the table to the kitchen and
back. Right now it's just two folders sitting next to each other:

- `/client` — the React app (built with Vite), styled with Tailwind, using React Router for pages
  and TanStack Query for talking to the server.
- `/server` — a plain Node/Express API that talks to a Postgres database (hosted on Supabase)
  through Prisma.

I didn't set up any fancy monorepo tooling like Turborepo or npm workspaces — it's just two normal
npm projects, each with their own `package.json`, and you run each one separately (`npm run dev` in
both folders).

## How the pieces fit together

### Client side
- `src/main.jsx` is where everything is present — it wraps the app in TanStack Query's provider,
  then the router, then my auth context.
- `src/context/AuthContext.jsx` is basically "who's logged in right now." It uses a TanStack Query
  hook that calls `GET /api/auth/me` and keeps that in sync, plus it has the login/register/logout
  functions. Anything in the app that needs to know the current user goes through this instead of
  hitting the API directly.
- `ProtectedRoute.jsx` and `PublicOnlyRoute.jsx` are small route guards. If you're not logged in and
  try to hit a protected page, you get bounced to `/login`. If you're already logged in and somehow
  land on `/login` or `/register`, you get sent to `/dashboard` instead.
- `AppShell.jsx` is just the nav bar (shows your name, your role, and a logout button) that wraps
  around the actual pages.
- `src/lib/api.js` is a tiny wrapper around `fetch` so I'm not repeating the same headers/error
  handling everywhere. All the calls go to `/api/...` — during dev, Vite proxies that over to the
  Express server on port 4000, so the browser thinks it's all one origin. That's actually what makes
  the login cookie behave nicely without any CORS headaches (more on that in decisions.md).

### Server side
- `src/index.js` just starts the server.
- `src/app.js` sets up Express — CORS, reading JSON bodies, reading cookies, hooking up the routes,
  and a couple of catch-all handlers for 404s and errors.
- Routes live in `src/routes`, the actual logic lives in `src/controllers` — pretty standard split.
  Routes just say "this URL goes to this function," controllers do the real work (checking input,
  hashing passwords, talking to the database).
- `src/middleware/auth.js` has the two functions everything else is going to depend on:
  `requireAuth` (checks you're logged in, otherwise 401) and `requireRole(...roles)` (checks you're
  the right kind of user, otherwise 403). Every future feature that needs "only managers can do
  this" or "you have to be logged in" is going to use these two.
- `src/lib/prisma.js` sets up one single Prisma client that the whole app shares (you really don't
  want to be creating a new database client on every request). Prisma's newest version needs a bit
  of extra setup to actually connect to Postgres directly — that's also explained in decisions.md.

## What actually happens when you log in

1. You type your email/password and the browser sends it to `POST /api/auth/login`.
2. The server looks you up by email, checks your password against the hashed one with bcrypt, and
   if it matches, creates a JWT with your user id and role baked into it.
3. That token gets set as a cookie — one your browser's JavaScript can't read (httpOnly), which is
   the point, since it keeps it safer from things like XSS attacks.
4. From then on, every request you make automatically carries that cookie. Any route wrapped in
   `requireAuth` checks it's valid and pulls out your id/role; routes also wrapped in
   `requireRole('manager')` additionally check you're actually a manager.
5. Whenever the app loads (or you refresh the page), it calls `/api/auth/me`, which double-checks
   the cookie is valid *and* goes back to the database to make sure you're still a real user. That
   way if someone got deleted from the system, their old token stops working right away instead of
   staying valid until it expires.

*(Update, Task 8: this guarantee got stronger — `requireAuth` itself now does this database check on
every single request, not just `/me`, and uses the role it finds in the database instead of the role
baked into the token. See the Task 8 section below for why.)*

## Menu management (added in Task 2)

Managers can now add, edit, and archive menu items — waiters can only look at the menu, not change
it. That rule isn't just hidden in the interface, it's checked on the server too, so even if someone
tried to fake a request, the server would still say no if you're not a manager.

The menu page also lets a manager peek at archived items and bring one back, instead of losing it
for good.

## Orders and order lines (added in Task 2)

A waiter can start an order for a table, then add items to it one at a time. If the exact same item
gets added twice, it doesn't create two separate lines — it just adds to the quantity of the one
that's already there, as long as the price hasn't changed since the first time it was added.

Every order shows a running total, and that total is calculated on the server using exact math, not
regular decimal math — this matters because normal decimal math in most programming languages can
get money amounts slightly wrong after enough additions, and nobody wants a bill that's a fraction
of a cent off.

A waiter can also delete an order entirely if it was started by mistake, before anything real happens
with it. That asks for a confirmation first so it's hard to do by accident.

*(Update — pre-deployment review: this wasn't actually true. The route had no status check at all,
so an order could be deleted at any point, including after being served, and doing so was a real
database delete that cascaded away the Task 13 audit trail. Deletion is now genuinely restricted to
before preparing starts, and "deleting" no longer removes the order or its history from the database
at all — it's a soft delete, kept visible via `GET /orders/:id`/`/timeline` and a new
`GET /api/orders/deleted` list. See decision #76.)*

## How an order moves through its life (added in Task 3)

Every order goes through a set path: placed, then accepted, then preparing, then ready, then served —
one step at a time, in that order. You can't jump ahead (like going straight from placed to ready),
and you can't go backwards either. The one exception is cancelling — an order can be cancelled, but
only while it's still placed or accepted. Once the kitchen has actually started preparing it, it's
too late to cancel the whole thing.

Any single item on the order can also be voided (basically taken off the bill) for as long as the
order is still open — meaning it hasn't been served or cancelled yet. Voiding always needs a short
reason, and it never actually deletes anything — it just marks that item as voided so there's a
record of what happened and why.

All of this is enforced on the server, not just in the interface. The buttons on screen only show
you the moves that are actually allowed right now, but even if someone bypassed the interface
completely, the server would still refuse anything that breaks these rules and explain why.

## Order collaborators and permission tightening (added in Task 4)

Every order still has exactly one primary waiter, set once at creation. On top of that, any number
of other waiters can now be added as collaborators — the primary waiter or a manager adds one
through `POST /api/orders/:id/collaborators`, picking from the list of existing waiters. Once added,
a collaborator can do everything the primary waiter can: add lines, void lines, change status.

Whether a given user is allowed to act on a given order all comes down to one function,
`canActOnOrder` in `src/lib/orderAccess.js` — true for a manager, the primary waiter, or a listed
collaborator, false otherwise. Every route that changes something about an order (add line, void
line, change status, archive/unarchive, delete) calls this same function instead of re-checking the
rule its own way, so there's exactly one place that decides who's allowed to touch an order.

Waiters also get their own list now — `GET /api/orders/mine` — every order where they're the primary
waiter or a collaborator, so they don't have to hunt through every order in the restaurant to find
their own. A manager technically can't be a collaborator (only waiters can be added as one), so this
route is mostly meaningless for a manager and the frontend just doesn't show it to them — but the
server doesn't bother blocking the request either, since it's harmless to leave open.

Reading an order (`GET /api/orders/:id`) and listing every order (`GET /api/orders`) are still open
to anyone logged in — this task only tightened who can change something about an order, not who can
look at one.

*(Update, Task 6: this changed — `GET /api/orders` now applies this exact visibility rule to its
results too. See the Task 6 section below.)*

## Table management (added in Task 5)

Before this, a waiter typed a table number by hand when starting a new order — nothing stopped a
typo, a made-up number, or two different waiters opening two separate orders on the same physical
table at the same time. Now there's a real `Table` list a manager controls: add a table with
`POST /api/tables`, remove one (really just archives it, same pattern as menu items) with
`POST /api/tables/:id/archive`, bring it back with `/unarchive`.

A table's "occupied" status isn't a column stored anywhere — it's worked out on the fly, by checking
whether any non-archived order currently sitting in an open status (placed, accepted, preparing, or
ready) has that table number. The moment an order reaches served or cancelled, or gets deleted, its
table is free again automatically, with nothing extra to update by hand. That open-status list used
to live only inside the order controller; it's now shared from `src/lib/orderStatus.js` so the order
rules and the table-occupancy rules can never quietly drift apart from each other.

When a waiter starts a new order now, `POST /api/orders` still takes a `table_number`, but the server
re-checks that the number belongs to a real, non-archived table and isn't already occupied — the
frontend only lets you click a table from the available list, but that's just convenience; the real
enforcement is server-side, same as every other rule in this app.

The `Table` model deliberately isn't a foreign key on `Order` — `Order.tableNumber` is still just a
plain number, exactly like it's been since Task 2. Tying them together with a real relation would
have meant backfilling every existing order with a matching table row before the migration could
even run; keeping them separate meant this whole feature could be added without touching the `Order`
table at all.

## Order search, filters, sort, and pagination (added in Task 6)

`GET /api/orders` used to just return every non-archived order, unfiltered, to whoever asked — a gap
left over from Task 4, since tightening who could *act* on an order never touched who could *see* one
in the list. This task closed that gap as part of building real search: the list now applies the
exact same visibility rule as `GET /api/orders/mine` — a manager sees everything, a waiter only sees
orders where they're the primary waiter or a collaborator — merged into the same `where` clause as
every other filter, not applied afterward on the results. That's on purpose: a waiter combining
filters (say, searching for a specific table, or filtering by another waiter) can never get back an
order they weren't already allowed to see, no matter what they search for.

On top of that visibility floor, the list now takes `search` (table number), `status`, `waiter`,
`date`, `sort` (`placed`, `status`, or `table`), `dir`, `page`, and `pageSize`, all validated, and
returns the matching page alongside the total number of matches (`{ data, total, page, pageSize }`)
so the frontend can show real pagination instead of guessing.

The one fiddly part was searching by table number as text — `tableNumber` is stored as a plain
integer, and Prisma can't do a partial ("contains") match against a number column. Rather than drop
the whole query to raw SQL, only that one lookup (a query for matching order ids, using Prisma's
safely-parameterized `$queryRaw` tagged template, casting the column to text and matching with
`ILIKE`) is raw — everything else (the other filters, sorting, pagination, the total count) stays
ordinary Prisma query-builder code built around whatever ids that lookup returns.

Since the visibility rule (primary waiter or collaborator) now applies to the main order list, the
frontend's separate "All orders / My orders" tabs from Task 4 would have shown a waiter the exact
same thing twice — so they came out, replaced by the one filterable, sortable, paginated list.

## Bulk menu updates and CSV order export (added in Task 7)

`PATCH /api/menu-items/bulk` lets a manager apply one change (a new price and/or a change in
availability) to a list of menu item ids in a single request. Each id is validated and updated
independently, in its own try/catch — not inside one `prisma.$transaction` covering the whole
batch — because a `$transaction` would roll every item back the moment one of them failed, and the
actual requirement is the opposite: report per item what happened (`ok`, or `rejected` with a
reason) instead of failing the whole batch over one bad id.

`GET /api/orders/export?date=YYYY-MM-DD` returns a CSV of every order placed that day — one row per
order line, with the order-level fields (table, status, waiter, placed time, total) repeated on
every line's row, and a single blank-fields row for an order that has no lines yet so it's never
silently missing from the export. It respects the exact same visibility as every other order
endpoint: a waiter only gets orders they're attached to, a manager gets everything for that date.
The CSV itself is hand-written — a small escape-and-join helper in `src/lib/csv.js` — rather than a
library, since this data is already flat rows of plain values with nothing nested or streamed. That
helper also neutralizes any field that starts with `=`, `+`, `-`, `@`, or a tab (prefixing it with a
literal `'`), so a name or void reason someone typed can't turn into a formula that executes when
the exported file is opened in Excel or Sheets. This one wasn't caught up front — it turned up in a
quick security pass over this feature specifically, right after it was built, proven with an actual
`=HYPERLINK(...)` payload in a waiter's own name, and fixed the same day, before the broader
whole-project audit in Task 8 below even started.

## Security audit and the fixes that came out of it (added in Task 8)

This task started with a bug report, not a brief: creating an order didn't actually require adding
any item to it. `POST /api/orders` now requires a `menu_item_id` and `quantity` up front, and creates
the order together with its first line in one nested Prisma write, so the two can never exist
separately — either both get created or neither does. Further items still go through the existing
`POST /:id/lines` route once the order exists.

That bug prompted a full security pass over the rest of the project. It turned up one critical
finding and four smaller ones:

- **Critical — self-registration as manager.** `POST /api/auth/register` took a `role` field
  straight from the request body with no gate at all, so any anonymous request could hand itself
  `role: "manager"` and get every manager-only permission in the app. This is what Task 9 (below)
  actually fixes properly, rather than just patching the one field.
- **Missing indexes.** `Order.primaryWaiterId`, `Order.tableNumber`, `OrderLine.orderId`, and
  `OrderCollaborator.waiterId` — the foreign-key columns actually filtered on in every order
  list/detail/visibility query — had no index at all. Added all four.
- **`GET /api/orders/:id` had no visibility check.** Every other order-reading endpoint picked up
  the primary-waiter-or-collaborator rule in Task 6; this one was left open in Task 4 on purpose and
  never revisited. It now calls the same `canActOnOrder` check every mutating route already used.
- **Table double-booking race condition.** The "is this table occupied" check and the order
  `create` in `createOrder` were two separate, unlocked statements — two requests for the same table
  arriving close together could both pass the check before either committed. Wrapped both in a
  `prisma.$transaction` with `Serializable` isolation, so Postgres itself detects the overlap and
  the loser gets a clean 409 asking it to retry instead of silently succeeding. (With the
  `@prisma/adapter-pg` driver this project uses, that conflict surfaces as a `DriverAdapterError`
  with the raw Postgres SQLSTATE `40001`, not the `P2034` code Prisma's own docs describe for its
  default engine — worth knowing if this ever needs debugging again.) The equivalent, lower-stakes
  race in `table.controller.js`'s table-create also got a `P2002` catch, since the database's own
  unique constraint already prevented the actual duplicate — it just wasn't turned into a clean
  error before.
- **`GET /api/users` exposed every coworker's email to any authenticated waiter.** Email is now
  only included in the response for a manager or admin; everyone still gets `id`/`name`/`role`,
  which is all the collaborator picker and the waiter filter dropdown ever needed.

Fixing the self-registration hole surfaced one more thing while verifying it: `requireAuth` was
extracting `id` and `role` straight from the JWT's own payload, never checking the database. That
meant a manager demoted to waiter (once Task 9 made that possible) would keep manager-level access
for as long as their existing 7-day token stayed valid — and, worse, a deleted user's token kept
working everywhere except `/me`, contradicting what this doc already claimed above. `requireAuth`
now looks the user up by id on every request and uses the role it finds there, full stop.

## Account roles and provisioning: admin, manager, waiter (added in Task 9)

There's a third role now, ranked above manager: `admin`. The rank order — `waiter < manager <
admin` — lives in one place, `src/lib/roles.js`, as an `atLeast(role, minRole)` helper; `requireRole`
and every hand-rolled `role === "manager"` check in the order/user controllers were switched to it,
so admin automatically gets everything manager already had (menu, tables, orders, bulk update,
export, acting on any order) without duplicating a single permission check.

Public registration is gone entirely — there's no `POST /api/auth/register` anymore, and no
`RegisterPage` in the client. Every account now comes from `POST /api/users`, gated by the same
`canManage(callerRole, targetRole)` rule used for password resets (see Task 10): a manager can
create a `waiter` account, only an admin can create a `manager` account, and `admin` itself is never
an assignable role through this endpoint — or through `PATCH /api/users/:id/role` (also admin-only
now, previously any manager). The creator sets the new account's initial password directly and
hands it to the person, since the account never self-registers.

That leaves one deliberate, permanent gap: nothing about the `admin` role — creating it, changing
it, resetting its password — has any HTTP path at all. The only admin account in this database came
from a one-time script, run once directly against Postgres and deleted immediately afterward. If the
admin account is ever lost, recovering it needs the same kind of direct database access, not an API
call — that's the tradeoff for having zero remote attack surface on the top of the hierarchy.

## Password reset and the create-account success card (added in Task 10)

`PATCH /api/users/:id/password` follows the exact same authority rule as account creation
(`canManage`): whoever could have created an account can also reset its password — a manager for a
waiter, an admin for a manager or a waiter, nobody (not even another admin) for an admin's own
account. This is the app's entire answer to "forgot password," since there's no email
infrastructure to send a reset link — the person who has authority over that account just sets a new
one and hands it over, the same way the account was created in the first place.

The Team page's "add account" form used to clear itself immediately after a successful create,
which meant a typo'd copy-paste or a closed tab could lose the password before it ever reached the
new hire. It now shows a dismissible card with the name/email/password together and a copy button,
explicitly labeled as a one-time reveal — the same pattern AWS/GitHub/etc. use for access keys and
tokens. If the password does get lost before being shared, there's deliberately no special recovery
path for that case: resetting it again is free, and the new hire never logged in with the lost one
anyway.

## What's not built yet, on purpose

- No menu, no orders, no dashboard content — `/dashboard` is literally just an empty page for now.
- No "forgot password" or email verification flow. *(Update, Task 10: partially addressed — an
  admin or manager can reset an account they manage, since there's still no email infrastructure to
  send a self-service reset link. See the Task 10 section below.)*
- No refresh tokens — it's one 7-day token, no silent renewal.
- No rate limiting on login/register yet.

## Where things actually run in production

The client deploys to Vercel (static build via `vite build`) and the server deploys to Render (a
plain Node web service) — genuinely two different domains at the infrastructure level. The first
deploy connected them with a direct cross-origin call (client's JS calling the Render URL directly)
plus `SameSite=None; Secure` on the auth cookie. That worked in a normal browser window, but broke
immediately in Incognito: a cookie set by a truly cross-site response is a third-party cookie no
matter what `SameSite`/`Secure` says, and Incognito blocks those outright. Login would "succeed"
(the response body carries the user, so the UI renders as logged in) and then every subsequent
request 401'd, since the cookie was never actually stored.

The fix (see decisions #78/#79) was to stop the browser from ever making a cross-site call at all:

- **Client → server calls go through a same-origin proxy, not a direct cross-origin call.**
  `client/api/[...path].js` is a real Vercel Serverless Function that hand-proxies every `/api/*`
  request to the deployed Render URL — the browser only ever talks to the Vercel domain, for every
  request including login. A plain `vercel.json` `rewrites` entry to an external URL was tried
  first and reverted (decision #79): it only reliably forwards GET/HEAD, so every POST (starting
  with login) came back a `405` straight from Vercel's edge, never reaching Render at all. A real
  function has no such method restriction — it forwards the method, the raw body, and every
  response header (including multiple `Set-Cookie` headers, via `Headers.getSetCookie()`) exactly
  as received. `VITE_API_BASE_URL` (`client/src/lib/api.js`) stays unset in this setup and the
  client defaults to the relative `/api` path, which the function handles. It still exists as an
  escape hatch for a host with no equivalent proxy capability, with the third-party-cookie tradeoff
  documented in `client/.env.example`.
- **CORS.** The server's `CLIENT_ORIGIN` env var (Render) must still be the exact deployed Vercel
  URL, no trailing slash (auto-trimmed defensively either way — see decision #78's sibling fix in
  `app.js`) — `cors({ origin: CLIENT_ORIGIN, credentials: true })` only allows that one origin
  through. With the proxy function forwarding the request server-side, this matters less for the
  browser's own request (which is same-origin) but the function forwards the original request's
  headers through to Render, Origin included.
- **The auth cookie.** `SameSite=None; Secure` in production (`auth.controller.js`, switched on by
  `NODE_ENV=production`) is still correct to keep — it's a superset of `Lax` that also permits
  same-origin requests, so it doesn't need to change now that the proxy function makes requests
  same-origin from the browser's perspective. What actually matters is that the cookie is now set by
  a same-origin response (as far as the browser is concerned), which is what makes it a first-party
  cookie no third-party-cookie policy touches.
- **Migrations.** `npm run migrate` runs `prisma migrate dev`, which is a local development command
  (it can prompt interactively and isn't meant to run unattended). Production runs
  `npm run migrate:deploy` (`prisma migrate deploy`) instead — a non-interactive command that only
  applies already-committed migrations, meant to run as part of the Render deploy step, before the
  server starts.
