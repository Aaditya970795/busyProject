# Build Plan

Just a running log of what got built, in what order, and why — updated after each task once it's
actually done and tested. This isn't a roadmap of what's coming next, just a record of what already
happened.

## Task log

### Task 1 — Getting the project set up, database, login system

It is completed both the client and server folders set up from scratch, setting up Prisma with
the User table, and building the whole login system — register, login, logout, checking who's
logged in, plus the middleware that protects routes based on whether you're logged in and what role
you have. On the frontend side: a login page, a register page, the logic that keeps track of who's
logged in, pages that redirect you if you're not logged in, and a nav bar with an empty dashboard page.

Why start here: pretty much nothing else in this app makes sense without a login system first — you
can't have "managers manage the menu" or "waiters take orders" as concepts until you actually have
managers and waiters as real logged-in users. So this had to come first, before any of the actual restaurant features.

