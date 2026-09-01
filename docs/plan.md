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

### Task 4 — Order collaborators and permission tightening

This closed a real gap left over from Task 3: any logged-in waiter could act on any order, not just
their own. Now every order still has exactly one primary waiter (set at creation, unchanged from
Task 2), but any number of other waiters can be added as collaborators, and a collaborator can do
everything the primary waiter can — add lines, void lines, change status. Whether a given user is
allowed to touch a given order now comes down to one shared check reused everywhere instead of
copy-pasted into every route: a manager, the primary waiter, or a listed collaborator, and nobody
else. Waiters also got a "my orders" list — every order where they're primary or a collaborator.

Why this came after Task 3: you can't restrict who's allowed to touch an order's status/lines until
the status and lines rules themselves exist, which is exactly what Task 3 built.

### Task 5 — Table management

Before this, a waiter typed any table number by hand when starting an order — nothing stopped a
typo, a made-up number, or two waiters opening two separate orders on the same physical table at the
same time. Now a manager owns a real list of tables (add one, remove one), and a waiter starting a
new order can only pick from that list, filtered down to whichever tables aren't currently occupied
by another open order. A search bar on both the table list and the order-creation picker makes it
quick to find one table out of a long list.

Why this came after Task 4: it's the same category of thing as Task 4 — tightening up who's allowed
to do what around an order — just aimed at the table number this time instead of who can act on the
order itself.

### Task 6 — Order search, filters, sort, and pagination

The order list (`GET /api/orders`) went from "return everything, unfiltered" to a real search: a text
search over the table number, filters for status/waiter/date, sorting by placed time/status/table,
and pagination that reports the total match count — all done server-side, not by fetching everything
into the browser and slicing it up there. It also closed a visibility gap left over from Task 4: the
list now only shows a waiter what they're actually allowed to see, the same rule their "my orders"
list already used, instead of every order in the restaurant.

A quick numbering note: the brief for this one called itself "task 5 of 10," but Task 5 in this log
is already taken by table management, which wasn't a formally numbered task when it landed in
between. Rather than renumber anything already written here, this one just became Task 6 in this log.

Why this came after table management: search/filter/sort is the kind of thing that matters more once
there's actually enough going on in the restaurant to need it — tables, collaborators, and the full
order lifecycle all needed to exist first for a "find me the accepted orders on table 12 from today"
search to mean anything.

