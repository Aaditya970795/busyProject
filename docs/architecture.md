# Architecture

## What this is

A restaurant order system replacing paper tickets. Managers own the menu, waiters take orders from
the table to the kitchen and back.

## The moving pieces, and how they talk to each other

Two folders sitting next to each other, no monorepo tooling (no Turborepo, no npm workspaces) just
two normal npm projects, each with its own `package.json`, run separately.

**`/client`** a React app built with Vite, styled with Tailwind, using React Router for pages and
TanStack Query for talking to the server.

- `src/main.jsx` wraps the app in TanStack Query's provider, then the router, then the auth context.
- `src/context/AuthContext.jsx` is "who's logged in right now" a TanStack Query hook that calls
  `GET /api/auth/me` and keeps it in sync, plus the login/logout functions. Anything that needs to
  know the current user goes through this instead of hitting the API directly.
- `ProtectedRoute.jsx` / `PublicOnlyRoute.jsx` are route guards bounce to `/login` if you're not
  logged in and try a protected page; bounce to `/dashboard` if you're already logged in and land on
  `/login`.
- `AppShell.jsx` is the nav bar (name, role, logout) wrapping the actual pages.
- `src/lib/api.js` is a thin axios wrapper so headers/error handling aren't repeated everywhere.
  Every call goes to `/api/...` never an absolute URL which is what lets the same code work
  whether that path is proxied locally by Vite or by the Vercel function in production (see "where
  each piece runs" below).

**`/server`** a plain Node/Express API talking to Postgres (hosted on Supabase) through Prisma.

- `src/index.js` starts the server.
- `src/app.js` sets up Express: CORS, reading JSON bodies, reading cookies, mounting the routes, and
  catch-all 404/error handlers.
- Routes live in `src/routes`, the actual logic in `src/controllers` routes say "this URL goes to
  this function," controllers do the real work.
- `src/middleware/auth.js` has the two functions almost everything depends on: `requireAuth` (are
  you logged in) and `requireRole(...roles)` (are you the right kind of user).
- `src/lib/prisma.js` sets up one shared Prisma client for the whole app, instead of creating a new
  database connection per request.

## Where each piece runs

Locally: client on `http://localhost:5173`, server on `http://localhost:4000`. Vite proxies `/api`
requests from the client straight to the server, so in dev they effectively share an origin.

In production: the client is a static Vite build deployed to Vercel; the server is a plain Node web
service on Render; the database is Postgres on Supabase. Client and server are genuinely different
domains, which the local setup's shared-origin proxy trick doesn't cover so `client/api/proxy.js`,
a real Vercel Serverless Function, forwards every `/api/*` request from the browser to the deployed
Render URL. The browser only ever talks to the Vercel domain, for every request including login.
This isn't just tidiness: a genuinely cross-site request (the client calling Render directly) makes
the login cookie a third-party cookie, which gets blocked outright in Incognito/private browsing
login looks like it works, then every request after that fails, because the cookie was never
actually stored. Two simpler versions of this proxy were tried and abandoned before landing on this
one: a plain URL rewrite to the external Render URL (only reliably forwards GET/HEAD every POST,
starting with login, came back rejected), and a dynamic catch-all function file (didn't route
correctly on Vercel at all, for reasons never fully explained, confirmed by testing a plain function
file that worked immediately in its place).

On the server side, `CLIENT_ORIGIN` must be set to the exact deployed Vercel URL for CORS to allow
it through, and `NODE_ENV=production` switches the auth cookie to `SameSite=None; Secure`, needed
for it to survive being set by a page on a different top-level domain. Migrations run via
`prisma migrate deploy` (never `prisma migrate dev`) as part of the Render deploy step, before the
server starts `prisma generate` runs immediately before that too, since the generated Prisma
client lives outside `node_modules` and wasn't guaranteed to survive from the build step into the
running server otherwise.

## One request, end to end: logging in

1. The browser sends email/password to `POST /api/auth/login`.
2. The server looks the user up by email, checks the password against the stored bcrypt hash, and
   if it matches creates a JWT carrying the user's id and role.
3. That token is set as a cookie the browser's own JavaScript can't read (`httpOnly`), which keeps
   it safer from things like XSS. In production it's also `Secure` and `SameSite=None`, since client
   and server are genuinely different domains once the request reaches Render (even though the
   browser itself only ever talked to the Vercel domain see "where each piece runs").
4. From then on, every request automatically carries that cookie. Any route wrapped in `requireAuth`
   checks it's valid and pulls out the user's id; routes also wrapped in `requireRole('manager')`
   additionally check the role. That role is looked up fresh from the database on every single
   request, not read from the token so a role change or a deactivation takes effect on the very
   next request, not whenever the token happens to expire (tokens last 7 days).
5. Whenever the app loads or refreshes, it calls `GET /api/auth/me`, which does the same fresh
   database check, so a deleted or deactivated account's old cookie stops working immediately
   instead of staying valid until it expires.

## What was decided not to build, and why

- **No self-service "forgot password."** There's no email infrastructure to send a reset link.
  Instead, whoever has authority over an account (the same rule as who can create it) can reset its
  password directly and hand it over a manager for a waiter, an admin for a manager or a waiter,
  nobody for an admin's own account.
- **No refresh tokens.** One 7-day token, no silent renewal.
- **No rate limiting on login.** A known, deliberately unfixed gap from a full project audit.
- **No schema-validation library.** Routes validate their input by hand instead.
- **No request logging or observability.**
- **No frontend error boundary.**
- **The slow-order alert sweep is a single in-process `setInterval`, not a real job queue.** There's
  no worker/queue infrastructure (no Redis, no Bull/Agenda) in this app, and adding one just for a
  once-a-minute check over a handful of rows would be a lot of new infrastructure for very little
  actual load. The tradeoff: if this app ever ran across multiple server instances, each instance
  would run its own sweep and could double-process the same stuck order not a problem today, since
  it runs as one process.

None of these block anything the brief asked for; they're documented as deliberate choices, not
silent gaps.
