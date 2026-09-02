# Build Plan

Just a running log of what got built, in what order, and why updated after each task once it's
actually done and tested. This isn't a roadmap of what's coming next, just a record of what already
happened.

## Task log

### Task 1 — Getting the project set up, database, login system

It is completed both the client and server folders set up from scratch, setting up Prisma with
the User table, and building the whole login system register, login, logout, checking who's
logged in, plus the middleware that protects routes based on whether you're logged in and what role
you have. On the frontend side: a login page, a register page, the logic that keeps track of who's
logged in, pages that redirect you if you're not logged in, and a nav bar with an empty dashboard page.

Why start here: pretty much nothing else in this app makes sense without a login system first you
can't have "managers manage the menu" or "waiters take orders" as concepts until you actually have
managers and waiters as real logged-in users. So this had to come first, before any of the actual restaurant features.

### Task 2 — Menu management and orders

This added the actual restaurant features on top of the login system: managers can add, edit, and
archive menu items; waiters can start an order for a table, add items to it, and see a running
total. Waiters can only look at the menu, not change it that's checked on the server, not just
hidden in the interface.

Why this came next: once people could log in and know their role, the next obvious thing was giving
managers something to manage and waiters something to actually do with an order. Nothing about
order status or cancelling existed yet on purpose that was saved for its own task.

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
everything the primary waiter can add lines, void lines, change status. Whether a given user is
allowed to touch a given order now comes down to one shared check reused everywhere instead of
copy-pasted into every route: a manager, the primary waiter, or a listed collaborator, and nobody
else. Waiters also got a "my orders" list every order where they're primary or a collaborator.

Why this came after Task 3: you can't restrict who's allowed to touch an order's status/lines until
the status and lines rules themselves exist, which is exactly what Task 3 built.

### Task 5 — Table management

Before this, a waiter typed any table number by hand when starting an order nothing stopped a
typo, a made-up number, or two waiters opening two separate orders on the same physical table at the
same time. Now a manager owns a real list of tables (add one, remove one), and a waiter starting a
new order can only pick from that list, filtered down to whichever tables aren't currently occupied
by another open order. A search bar on both the table list and the order-creation picker makes it
quick to find one table out of a long list.

Why this came after Task 4: it's the same category of thing as Task 4 tightening up who's allowed
to do what around an order just aimed at the table number this time instead of who can act on the
order itself.

### Task 6 — Order search, filters, sort, and pagination

The order list (`GET /api/orders`) went from "return everything, unfiltered" to a real search: a text
search over the table number, filters for status/waiter/date, sorting by placed time/status/table,
and pagination that reports the total match count all done server-side, not by fetching everything
into the browser and slicing it up there. It also closed a visibility gap left over from Task 4: the
list now only shows a waiter what they're actually allowed to see, the same rule their "my orders"
list already used, instead of every order in the restaurant.

A quick numbering note: the brief for this one called itself "task 5 of 10," but Task 5 in this log
is already taken by table management, which wasn't a formally numbered task when it landed in
between. Rather than renumber anything already written here, this one just became Task 6 in this log.

Why this came after table management: search/filter/sort is the kind of thing that matters more once
there's actually enough going on in the restaurant to need it tables, collaborators, and the full
order lifecycle all needed to exist first for a "find me the accepted orders on table 12 from today"
search to mean anything.

### Task 7 — Bulk menu updates and CSV order export

Two independent features. Managers can now select several menu items and apply one change (a new
price and/or a change in availability) to all of them in a single action, with a per-item pass/fail
report instead of an all-or-nothing failure a typo'd id or a rule one item happens to violate
doesn't block the rest of the batch. Separately, a day's worth of orders can now be exported as a
CSV (one row per order line, order-level fields repeated on each row, a computed total column),
respecting the same visibility every other order endpoint already uses a waiter only gets orders
they're attached to, a manager gets everything for that date.

A numbering note, same as Task 6's: the brief for this one called itself "task 6 of 10," but Task 5
in this log (table management) already used up a slot the brief's own numbering doesn't count, so
this one lands as Task 7 here.

Why this came after search/filter: bulk edits and exports are the kind of thing that matters once
there's actually a meaningful number of menu items and orders to act on in aggregate Task 6 built
the "find things" half, this built the "act on many at once / pull them out" half.

### Task 8 — Security audit and the fixes that came out of it

This one didn't come from a numbered brief it started with a real bug report: creating an order
didn't actually require adding any item to it, so a single click could leave an empty order sitting
in the system. That got fixed first (an order and its first line are now created together, in one
atomic write, or neither exists), then I asked for a full pass over the whole project for anything
else that had been missed.

The audit turned up one critical issue and four smaller ones. Critical: any anonymous person could
self-register as a manager, since the entire manager/waiter permission model rested on a `role`
field the client got to pick at signup. The smaller ones: the order list was missing database
indexes on the columns it's actually filtered by; `GET /api/orders/:id` had never picked up the
visibility rule the rest of the order endpoints got in Task 6; two concurrent requests could
double-book the same table, since the occupancy check and the order creation weren't atomic; and
`GET /api/users` was handing every authenticated waiter every coworker's email address. All five got
fixed, each verified on its own including real concurrent requests fired at the same table to
prove the race condition was actually closed, not just less likely before moving to the next.

Fixing the self-registration hole surfaced a second bug on the way: a demoted manager's existing
login cookie kept granting manager-level access for up to 7 days, because the server trusted the
role baked into the token instead of checking the database on every request. Fixed the same way
found while verifying the first fix, fixed immediately, verified separately.

Why this wasn't scheduled: security gaps don't wait for a task number this was worth stopping the
regular task-by-task order for.

### Task 9 — No more self-registration: admin/manager/waiter account provisioning

Closing the self-registration hole properly meant deciding how anyone becomes a manager at all,
since the old path anyone can just say `role: "manager"` at signup was the actual bug, not just
a missing check. Landed on a third role, admin, above manager: nobody can self-register anymore, at
any role, for any account. A manager can create a waiter account; only an admin can create a manager
account or change anyone's existing role. The one deliberate gap: no account, including admin's own,
is ever created or promoted to admin through the API the first admin came from a one-time script
run directly against the database once and then deleted, so there's zero HTTP path to the top of the
hierarchy, ever.

Why this came right after the audit: this was the actual fix the self-registration finding needed,
not a separate feature closing the hole without giving admins and managers a real way to create
accounts would have just locked the app out of ever adding new staff.

### Task 10 — Password reset, and not losing the password you just set

Two follow-on questions once account creation was locked down to admins and managers: what happens
when someone forgets their password, given there's no email infrastructure to send a reset link;
and what happens if the admin or manager who set someone's initial password loses track of it before
handing it over. The first got a real endpoint whoever has authority over an account (the same
rule as who's allowed to create it) can reset its password directly, with the one exception that
nobody can reset an admin's password except the same one-time database script used to bootstrap it.
The second needed no new backend at all: the create-account form now shows the new password on
screen after success, with a copy button and a clear "won't be shown again" warning, and if it does
get lost before being shared, resetting the password again is free the new hire never logged in
with the lost one anyway.

Why this came last: both of these questions only make sense once accounts are actually created by an
authority figure instead of self-registration "forgot password" and "I lost the password I just
set for someone" aren't real problems until that model exists.

### Task 11 — Dashboard

A single manager-facing screen answering "how's the restaurant doing right now": headline numbers
(open orders, orders placed today, orders served today with a vs-yesterday delta, revenue today with
an average-order-value figure), a breakdown of open/closed orders by status, a leaderboard of orders
by waiter, today's top-selling items by quantity and revenue, a 14-day trend chart togglable between
orders-served and revenue, and a feed of the most recent orders each one linking straight into that
order's detail page. The whole summary comes from one endpoint (`GET /api/dashboard/summary`),
computed server-side rather than shipping every order to the browser and aggregating it there.

A follow-up pass then asked for the dashboard to actually mean something for a waiter too, since the
first version simply hid the whole page from anyone who wasn't a manager. Waiters now get a real,
different view instead of a blank restriction message a worklist built from their own
`GET /orders/mine` data: how many of their orders are still open, how many they placed and served
today, and their open orders sorted oldest-first, since those are the ones that have been waiting
longest.

Why this came after the account-provisioning and password-reset work: a "how's the restaurant doing"
view only makes sense once there's a stable set of roles to build different views for a manager
sees restaurant-wide numbers, a waiter sees their own worklist and both needed the account model
from Tasks 9 and 10 settled first.

### Task 12 — Fully responsive UI pass

Everything up to this point had only ever been built and checked at a normal desktop browser width.
This task went through every page and fixed what breaks on a phone or tablet: the nav bar (brand +
five links + user info + logout, all in one row) completely overflowed below desktop width, so it now
collapses behind a hamburger button into a stacked mobile drawer below Tailwind's `md` breakpoint.
Every data table (Menu, Orders, Order Detail, Team, the dashboard's status breakdown) now scrolls
horizontally inside its own container on a narrow screen instead of squashing its columns or breaking
the page layout, and header rows plus a handful of fixed-width form fields now wrap or stack to full
width instead of overflowing or getting squeezed unreadably small.

Why this came last, after every feature task: a responsive pass is the kind of thing that's worth
doing once across a finished set of pages, not repeated after every individual feature lands
retrofitting every page at once also meant one consistent pattern (the same horizontal-scroll-table
treatment, the same header flex-wrap fix) instead of a different ad hoc fix per page.

### Task 13 — Order audit timeline

A brief numbered "task 8 of 10" (landing as Task 13 in this log, same renumbering situation Tasks
6 and 7 already noted). Every order now keeps a permanent, append-only history of everything that
happened to it: every status change (old status, new status, who did it), every line added or
voided (with the void reason), and any free-text note a manager or waiter leaves on it. A new
`OrderEvent` row is written in the same database transaction as the change it records a status
update, a line being added, a line being voided so the mutation and its audit entry can never
land as two separate statements that drift apart if one succeeds and the other doesn't. Nothing in
the app is ever allowed to update or delete one of these rows once written, including for a manager
an audit trail that can be edited after the fact isn't an audit trail. The order-detail page shows
this as a plain-English activity feed ("Jane changed status from Placed to Accepted", "Raj voided
'Grilled Salmon'reason: out of stock"), with a small form to add a note.

This also gave the dashboard (Task 11) a real fix for something it had been approximating since it
was built: "served today" and the 14-day served/revenue trend used to be guessed from an order's
`updatedAt` timestamp, which isn't actually "the moment it became served" and could be thrown off by
archiving and unarchiving an order. Both now read the real timestamp off the order's own
status-changed-to-served event instead.

Why this came after every earlier feature task: an audit trail only has something to record once
there are actual status changes, line edits, and voids happening — Tasks 2 through 10 built all of
the mutations this task now logs. It came before any alerting work (explicitly out of scope for this
task) since alerts would need to react to these same events, which had to exist first.

