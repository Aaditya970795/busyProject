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

## What's not built yet, on purpose

- No menu, no orders, no dashboard content — `/dashboard` is literally just an empty page for now.
- No "forgot password" or email verification flow.
- No refresh tokens — it's one 7-day token, no silent renewal.
- No rate limiting on login/register yet.

## Where things actually run in production

Haven't gotten there yet — right now this is all local dev, running against a real Supabase
database. I'll fill this section in once there's an actual deployment task.
