# Build Plan

A record of what got built, in what order, and why updated after each session once it's actually
done and tested. Not a roadmap of what's coming next.

## How the work was split into sessions

Most sessions map one-to-one onto one of the brief's ten numbered goals. A handful of extra sessions
weren't part of any numbered goal but were needed to actually finish them properly: table
management (closing a real gap in how orders reference a table), a full security audit and its
fixes, the account-hierarchy work that audit required, password reset, a fully-responsive UI pass,
staff deactivation plus two follow-ups to the slow-order alert system, and the deployment work at the
very end. Those are folded into whichever goal below they're closest to, rather than listed as their
own separate track.

## What order things were built in, and why

**1. Accounts and roles.** Had to come first nothing else in the app makes sense without real
logged-in users first. "Managers manage the menu" and "waiters take orders" aren't real concepts
until managers and waiters exist as actual accounts. Built as register/login/logout, "who am I," and
the two pieces of middleware everything else depends on: one that checks you're logged in, one that
checks your role.

This came back to be hardened twice more, both driven by real problems rather than the original
brief. A full security audit (triggered by an unrelated bug report see "orders" below) found the
single biggest issue in the project: the register endpoint took `role` straight from the request
body, so anyone could sign up as a manager. The immediate patch (strip `role`, force every signup to
waiter) didn't actually answer the real question how does a manager account ever get created
legitimately so the next session removed public registration entirely and added a third role,
`admin`, above manager: admin creates managers, a manager creates waiters, and admin is never
assignable through the API at all (the one admin account came from a one-time script run directly
against the database, then deleted). That, in turn, raised the question of what happens when someone
forgets a password with no email system to send a reset link answered with the same
whoever-can-create-it-can-reset-it authority rule, plus a fix so a freshly-set password shown on
screen doesn't vanish before it's actually handed to the new hire.

Later, after a full audit of everything built against real risk, a way to remove a waiter or manager
from the team was added too checking the schema first showed a real delete isn't just undesirable
but impossible once someone has order history, so it's a deactivation, following the exact soft-
delete pattern menu items and tables already used.

**2. Orders.** Once people could log in and know their role, the next obvious step was giving
waiters something to actually create an order for a table. This also brought menu management
along with it (managers need something to manage before a waiter has anything to order).

A real bug report during a later session ("clicking new order created an order with nothing in it")
led to that being fixed atomically, and to a full security audit of the rest of the project — which
found, alongside the self-registration hole above, a table-double-booking race condition (two
requests could occupy the same table at once; closed with a database transaction) and missing
indexes on columns the order queries actually filter by.

Table management landed as an unofficial, unscheduled session in here too: waiters were typing table
numbers by hand, with nothing stopping a typo or two people opening two orders on the same physical
table. A manager-controlled table list replaced that, with occupancy worked out from whichever orders
are currently open rather than a status flag that would need remembering to flip.

**3. Order lines.** Built alongside orders in the same session adding items to an order, with a
running total computed on the server using exact (not floating-point) math, and a rule that adding
the same item twice combines into one line instead of two, as long as the price hasn't changed since
it was first added.

**4. The lifecycle.** Came after orders and lines existed, since there's nothing to move through
stages until they do. Added the placed → accepted → preparing → ready → served path, one step at a
time, cancelling only while still placed or accepted, and voiding a single item with a required
reason for as long as the order stays open.

**5. Collaborators.** Closed a real gap left by the lifecycle work: any logged-in waiter could act on
any order, not just their own. Couldn't be built until the status/lines rules it restricts already
existed. Added exactly one primary waiter per order plus any number of collaborators, with one
shared "can this user touch this order" check reused everywhere instead of copy-pasted per route.

**6. Finding orders.** Search/filter/sort/pagination matters once there's actually enough going on to
need it tables, collaborators, and the full lifecycle all needed to exist first for "find the
accepted orders on table 12 from today" to mean anything. Also closed a visibility gap left over from
collaborators: the main order list had never picked up the same "only see what you're allowed to"
rule the "my orders" list already used.

**7. Bulk actions and CSV export.** Two independent features that matter once there's a meaningful
number of menu items and orders to act on in aggregate this is the "act on many at once / pull them
out" half, where the previous goal built the "find things" half. A manager can apply one
price/availability change to several menu items with a per-item pass/fail report instead of an
all-or-nothing failure; a day's orders export to CSV with the same visibility rule as everywhere
else. A CSV-formula-injection hole (a typed name or void reason could execute as a formula when the
file's opened in Excel) was found in a quick security pass right after this landed, and fixed the
same day.

**8. The dashboard.** Needed a stable set of roles to build different views for, so it came after the
account-hierarchy and password-reset work settled that model a manager sees restaurant-wide
numbers, a waiter sees their own worklist. Headline stats, status/waiter/top-seller breakdowns, and a
14-day trend chart for managers; a real worklist view instead of a locked-out page for waiters, built
from data that already existed.

A fully responsive pass across every page happened after this worth doing once across a finished
set of pages rather than repeated after each individual feature, so the nav bar, every data table,
and a handful of fixed-width form fields all got the same fix pattern instead of a different ad hoc
one per page.

**9. The audit timeline.** Needed every earlier goal's mutations to actually exist before there was
anything to record every status change, every line added or voided, every note. Written into the
same database transaction as the change itself, and never editable or deletable afterward by anyone,
including a manager. This also gave the dashboard a real fix for something it had been
approximating: "served today" and the trend chart used to guess from an order's last-touched
timestamp; both now read the order's actual served-at event instead.

**10. Slow-order alerts.** The last feature goal before deployment. An order open too long without
reaching Ready shows up in an alerts list with a nav badge; acknowledging clears it, and it reappears
if the order is still stuck well past a second threshold. Didn't need the audit timeline to function,
but landed after it since it was the brief's own last feature step before deployment.

Two follow-up sessions extended this further: one added a "clear table" shortcut (really the
existing cancel transition, reused), a more urgent severity tier for orders far overdue, and
tracking of who acknowledged an alert; the other fixed alert durations rendering as raw minutes
instead of readable time, and added a background sweep that auto-cancels a genuinely abandoned order
once a minute, without a person clicking anything.

A last session, after a broader audit of the project, added an exemption to that auto-clear sweep
(any order a human has already acknowledged is left alone, since a customer might still be sitting
there) and a toast notification to the responsible waiter when the sweep does cancel one of their
orders.

**After all ten goals: deployment.** The client went to Vercel, the server to Render, both against
the real Supabase database. Getting login to actually work once client and server were on different
domains took several iterations see `docs/decisions.md` for what was tried and what actually
worked.

## What was estimated versus what it actually took

No session started with a written-down hour estimate, so there's nothing to compare against
literally. The one place expectations were clearly off in hindsight: deployment was treated as the
last, short administrative step after all ten feature goals were done and it ended up being the
single longest stretch of troubleshooting in the whole project, needing four different attempts
before login actually worked reliably across Vercel and Render (see `docs/decisions.md`). Every
feature goal, by contrast, landed in roughly one session each, which is close to what was expected
going in.

## What got cut when time ran short

Nothing was consciously cut because time ran out. Everything that's still missing no rate limiting
on login, no refresh tokens, no request logging, no frontend error boundary, the alert sweep being
single-process (see `docs/architecture.md`) was a deliberate scope call made and written down as
such at the time, not a feature abandoned mid-build. If anything ran short, it was follow-through on
some of those already-known gaps rather than a planned feature getting dropped.
