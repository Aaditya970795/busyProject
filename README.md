<<<<<<< HEAD
# Restaurant Order Management System

A system to replace paper tickets at a restaurant. Managers own the menu, waiters run orders from
the table to the kitchen and back. Still early — right now it's just the login system and the
project skeleton, more gets added task by task (see `docs/plan.md` for the build order).

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


## How much time did you actually spend?

## What would you do next, with another 12 hours?


## What are you least happy with in this codebase, and why?


=======
# busyProject
>>>>>>> 1e6d33b453effbbebe65be3ec83d6a47a7120a72
