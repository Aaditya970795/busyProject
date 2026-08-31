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

### Task 2 — Menu management and orders

This added the actual restaurant features on top of the login system: managers can add, edit, and
archive menu items; waiters can start an order for a table, add items to it, and see a running
total. Waiters can only look at the menu, not change it — that's checked on the server, not just
hidden in the interface.

Why this came next: once people could log in and know their role, the next obvious thing was giving
managers something to manage and waiters something to actually do with an order. Nothing about
order status or cancelling existed yet on purpose — that was saved for its own task.

### Task 3 — Order status and voiding items

This added the rules for how an order moves through its life: placed, accepted, preparing, ready,
served, one step at a time, plus the ability to cancel an order early on or void a single item with
a reason. Before this task, every order just sat there as "placed" forever with no way to move it
along or take something off the bill.

Why this came after Task 2: you can't build the rules for moving an order through its stages until
the order and its items actually exist first, which is exactly what Task 2 built.

