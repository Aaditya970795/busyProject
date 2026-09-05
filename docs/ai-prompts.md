# AI Prompts Log

What was asked for on each goal, what came back, and what had to be fixed or pushed back on.

---

## Accounts and roles

### Prompt

The overall project (a restaurant order system, managers own the menu, waiters run orders) plus the
exact tech to use, with instructions not to swap anything out without asking first: React + Vite +
Tailwind + React Router + TanStack Query on the frontend, Node + Express on the backend, Postgres
through Supabase using Prisma, and a login system built by hand with bcrypt and a JWT in a cookie the
browser's JavaScript can't touch. Role checks had to happen on the server, not just hidden in the UI.
Also: ask before installing anything or running a migration against the real database, and prove it
works with real requests, not just a claim.

### What you got

Everything on the list, proven with real requests registered a manager and a waiter, logged in as
each, checked the role came back right, checked a logged-out request gets rejected plus a real
browser walkthrough of the login/register pages and the redirect behavior.

### What you corrected

- Setting up Prisma quietly installed a not-yet-released version instead of the stable one, self-
  caught and flagged; switched to stable.
- The same setup dumped unrelated AI-tool config folders into the project; removed.
- The Prisma version landed on needed an extra adapter package to connect to Postgres at all;
  approved adding it.
- A real database password had a stray line and an `@` symbol that broke the connection string;
  cleaned up manually.

### Later, closing the self-registration hole (a security audit finding, not part of the original brief)

Asked the obvious follow-up once self-registration as a manager had to close for good: how does a
manager account ever get created? Went back and forth on the actual design before any code got
written landed on a real `admin` tier above manager, with public registration removed entirely
once it was raised that self-registration for waiters was also a real problem (anyone who found the
site could make themselves an account).

**What you got:** a three-level role hierarchy with one shared rank-check helper, the register
endpoint and page removed completely, account-creation and role-change endpoints gated the agreed
way, and a one-time bootstrap script for the very first admin account, deleted right after running
it. Proven with real accounts at every boundary a manager blocked from creating a manager, a
waiter blocked from creating anything, admin able to do everything a manager could.

**What you corrected:** nothing to fix, but this was real back-and-forth on the design itself, not a
spec handed over and built to.

### Later, password reset

Asked what happens when someone forgets a password with no email system to send a reset link.
Recommended the same authority model as account creation rather than anything needing email
infrastructure agreed. A separate question about what happens if the password-setter loses track
of a freshly-set password before sharing it got the advice not to store it anywhere retrievable, and
to show it once on a success screen with a copy button instead.

**What you got:** the reset endpoint following the account-creation authority rule, and a create-
account form that now shows a dismissible card with the password and a copy button instead of
clearing itself immediately. Verified with real accounts and, for the copy button, an actual paste
into another field to prove it worked.

**What you corrected:** nothing both parts went through clean.

### Later, staff deactivation

Part of a three-part request (see "Slow-order alerts" below for the other two) asking for a way to
remove a waiter or manager from the team when they leave.

**What you got:** checked the schema before proposing anything, found a real delete isn't just
undesirable but impossible once someone has order history, and built it as deactivation instead,
matching the pattern already used for menu items and tables. Verified live a deactivated account's
existing session died on its next request, a fresh login got a clear message, and reactivating it
restored access.

---

## Orders

### Prompt

Menu management for managers (add/edit/archive, waiters view-only) plus waiters starting an order
for a table with items and a server-computed running total. Explicitly nothing about status yet.

### What you got

Built and proven a waiter blocked from creating a menu item, an order created and totalled
correctly.

### What you corrected

After trying it personally: archiving a menu item made it vanish with no way back, adding the same
item twice created duplicate lines, and prices showed in dollars instead of rupees all three
fixed, plus a general visual cleanup. Also asked for an outright order-delete option (with
confirmation) for a mistaken order.

### Later, a real bug report and the audit it triggered

Found directly: clicking "new order" created an order with nothing in it. Asked for that fixed and
the rest of the project checked for anything else missed.

**What you got:** the empty-order bug fixed atomically first, then a real audit re-read every
controller, checked actual indexes against the schema, registered a throwaway account to prove the
self-registration hole was real before reporting it. Findings beyond self-registration: missing
indexes, a table-double-booking race (closed and proven with real concurrent requests, not just
reasoning), an order-detail endpoint missing its visibility check, and an endpoint leaking every
coworker's email. All fixed, each verified before moving to the next.

### Later, table management

Not a formally numbered task a real gap described directly: waiters typing table numbers by hand,
with typos, made-up numbers, and double-bookings all possible. Asked for a manager-owned table list
and a waiter picker restricted to actually-free tables, with search.

**What you got:** a manager-only table list (soft-archive remove/restore), a search bar, and a
picker on the order screen restricted to free tables, with the server enforcing the same rule
independent of what the picker shows.

**What you corrected:** the biggest environment snag of any session Prisma's own migration tool
couldn't reach the real database from this machine at all, even though a plain database connection
worked fine. Narrowed to something on the machine blocking Prisma's connection program specifically;
fixed by switching to a different Supabase connection address and applying that one migration by
hand. Separately, hit a proxy error later because the backend server had been shut down after
verification and wasn't restarted restarted it.

---

## Order lines

Built in the same session as orders above items added to an order with a server-computed running
total, and the same-item-twice-combines-into-one-line rule. No separate prompt of its own; see
"Orders" for what was asked and what came back.

---

## The lifecycle

### Prompt

The exact rules for how an order should move through its stages placed, accepted, preparing,
ready, served, one step at a time cancelling only allowed early on, and voiding a single item with
a required reason as long as the order isn't finished. Reject anything that breaks these rules with
a clear explanation, not a generic error.

### What you got

Tried every wrong move first (skipping steps, going backwards, cancelling too late, voiding on a
finished order, voiding with no reason) and showed each one rejected with a clear message, then
walked a real order through the full path to served.

### What you corrected

Nothing to catch this time but a real gap was caught unprompted while testing: items could still be
added to an order that had already been cancelled, quietly breaking the point of cancelling
something. Fixed on the spot and flagged afterward.

---

## Collaborators

### Prompt

The exact gap to close: any logged-in waiter could act on any order, not just their own. Laid out
the rules precisely one primary waiter per order, any number of collaborators with full
permissions, one shared "can this user act on this order" check reused everywhere. Left open who's
allowed to add a collaborator, asked for a defensible pick with reasoning.

### What you got

The collaborator table, the shared permission check retrofitted onto every existing order-mutating
route, a "my orders" list, and a reasoned pick (primary waiter or manager) for who can add one.
Proven with real accounts an unrelated waiter rejected on every mutating action, then able to act
on everything once added as a collaborator, with a manager unaffected either way, and the test data
cleaned up afterward.

### What you corrected

Nothing this one went through clean on the first pass.

---

## Finding orders

### Prompt

Real search, filters (status/waiter/date), sorting, and pagination with a real total count, all
server-side no fetching everything into the browser to filter there. Pointed out the specific
problem with searching a number column as text and asked for a reasoned choice between two honest
approaches. Reuse whatever visibility rule already existed rather than invent a second one.

### What you got

The whole thing behind the existing order-list endpoint, with a reasoned pick (one raw SQL query
just for the table-number search) and the existing visibility rule pulled out into one shared
function instead of copied. Proven with over a dozen seeded orders across different waiters/tables/
statuses/dates, a combined search+filter+sort+page-2 request checked against the exact expected
slice, and a specific check that filtering by another waiter's id never leaked orders outside what
was actually allowed.

### What you corrected

Nothing to fix but flagged on its own that this made an existing documentation line out of date,
without rewriting it unasked.

---

## Bulk actions and CSV export

### Prompt

Two things: bulk price/availability updates for menu items with a per-item pass/fail report instead
of all-or-nothing, and a CSV export of a day's orders. Asked to confirm the CSV approach (hand-write
vs. a library) before building it, and to verify with a mixed valid/invalid bulk update and a real
exported file checked against the order-detail totals.

### What you got

Both built the bulk update processing each id independently so one bad item never blocks the rest,
proven with a real mixed batch; the export picked a row-per-line shape.

### What you corrected

Approved installing a CSV library when asked, then reversed that call and asked for a hand-written
approach instead switched cleanly. Separately, right after this landed, a follow-up security check
on the feature turned up a real CSV-formula-injection hole (a typed name or void reason could execute
as a formula in Excel); fixed once approved, proven with an actual malicious payload that came back
neutralized.

---

## The dashboard

### Prompt

A manager-facing screen summarizing how the restaurant is doing headline counts, revenue,
breakdowns, trends backed by real server-side aggregates, not the client computing numbers from
every order.

### What you got

One summary endpoint powering stat cards, a status breakdown, a waiter leaderboard, top sellers, a
14-day trend chart, and a recent-orders feed, gated to managers. Verified live against real data,
including toggling the chart between orders and revenue.

### What you corrected

Nothing to fix but a direct follow-up pointed out waiters just saw a locked-out page and asked for
something real there instead. Got a genuinely different waiter view (their own open-order count,
today's activity, oldest-open-first list) built entirely from data that already existed.

### Later, the fully responsive pass

The entire ask: "make the UI fully responsive for all types of devices."

**What you got:** an audit of every page first (every `<table>`, every fixed-width field) before
touching anything, which found the nav bar as the single most broken thing on mobile fixed first
since a broken nav makes everything else unreachable. Every data table wrapped in horizontal scroll,
header rows and fixed-width fields made to wrap, verified in a real browser at phone and tablet
widths rather than trusted on paper.

**What you corrected:** nothing directly asked but a real bug was self-caught during that browser
verification: a create-item form's fields were getting squeezed instead of stacking at phone width,
found by actually looking at the rendered layout rather than reading the Tailwind classes, fixed the
same way every other form on the page already worked.

---

## The audit timeline

### Prompt

A permanent, append-only history on every order every status change with who made it, every line
added or voided with its reason, and free-text notes explicitly forbidding any code path from ever
editing or deleting one of these rows, including for a manager. Gave the exact shape wanted, asked
for the writes to go inside the same transaction as the change itself, and for the dashboard's
existing approximation of "served today" to be switched over to the new event log as part of the
same piece of work.

### What you got

The event table and its logging wired into every relevant route, each write in the same transaction
as its mutation, a timeline feed on the order page with a note form, and the dashboard figures
switched over as asked, with the reasoning for why that's a real fix and not just a change. Proven
with one real order walked through a line add, a void, every status to served, and a note, then the
full eight-event timeline checked in order, and the dashboard numbers checked against that same order.

### What you corrected

A progress check partway through ("have you completed audit timeline?? if not then do it") was
answered honestly rather than assumed finished, since only the schema, migration, and logging helper
existed at that point.

---

## Slow-order alerts

### Prompt

An order open too long without reaching Ready should show up in an alerts area with a nav badge; a
waiter or manager acknowledges it to clear it, and it should come back if the order is still stuck
well past a second threshold. Gave the exact filter shape wanted (real database filtering, not
fetch-then-filter), asked for both thresholds as environment variables, a reasoned polling interval,
and an explicit reasoned decision on whether acknowledging belongs in the audit timeline. Asked for
verification by directly editing test-order timestamps rather than actually waiting.

### What you got

The alert query, the acknowledge endpoint behind the same authorization as every other order
mutation, 30-second polling matching the dashboard's own interval, and a reasoned decision to keep
acknowledging out of the timeline (it's about staff attention, not a change to the order itself).
Verified with a backdated order appearing, one that reached Ready in time never appearing, an
acknowledged one disappearing immediately, and it reappearing once its acknowledgement was backdated
past the reappear window.

### What you corrected

While documenting the new environment variables, a `.gitignore` pattern that had been silently
excluding `server/.env.example` from git since the very first commit was caught and fixed the
README had been telling every new developer to copy a file that was never actually tracked.

**Something that went wrong, and what was done about it:** a string of dropped em-dashes across
several documentation entries from the two sessions right before this one turned sentences into
run-ons that didn't actually parse. Found by rereading the prior work line by line rather than being
pointed out, and fixed everywhere it turned up before adding this session's own entries.

### Later, a real screen showed "Critical — open 2814m"

Pointed at the raw-minutes display directly and asked for it to read like actual time, plus a
genuinely automatic way to clear a stuck order without anyone clicking anything.

**What you got:** a proper duration formatter, and after flagging the distinction unprompted that
"deleted" would destroy the audit history a delete-then-becomes-cancel an automatic background
sweep that cancels an abandoned placed/accepted order once a minute, skipping any order already
being prepared, with the audit trail crediting the action to "the system" rather than a person.
Verified by backdating both a placed and a preparing order and confirming only the placed one got
swept and running the sweep for real also cleared several genuinely stale orders left over from
much earlier testing.

**Something that went wrong, and what was done about it:** the migration for this change failed
twice once because `npx` tried to install and run a pre-release Prisma version instead of the
pinned stable one (killed before it could run anything, confirmed the pin was untouched, and
switched to calling the local `prisma` binary directly to prevent a repeat), and once because the
database was briefly unreachable, which cleared on a retry.

### Later, the auto-clear worry and notifications

Part of a three-part request (staff deactivation covered under "Accounts and roles" above) asking,
without being told what to build: could a customer physically still waiting get their order
auto-cancelled anyway even though a waiter already knows about the delay? Also asked for a toast
notification to the responsible waiter when auto-cancel does fire, explicitly ruling out websockets
and naming `react-toastify` directly. Two follow-up questions were asked back before any code was
approved to start once because the explanation was too abstract to picture, once to confirm
toastify was purely a display layer over polling.

**What you got:** agreement that the concern was valid, with the exact fix anticipated exempt any
order that's ever been acknowledged plus the honest trade-off named unprompted: a single
acknowledgment with no real follow-through means an order can sit open forever, accepted rather than
solved with more logic since the critical-tier escalation already keeps it visible. For
notifications: a small table written in the same transaction as the cancellation, polled on the same
rhythm as the alerts badge, displayed with the named library. Verified live a deactivated account
losing its session immediately, an acknowledged order surviving the sweep while an unacknowledged one
didn't, and a real notification delivered through the unread endpoint.

**Something that went wrong, and what was done about it:** two real issues during verification, both
self-caught. A login request returning a bare 500 turned out to be an already-running server process
that hadn't picked up a schema change, not a code bug confirmed by starting a fresh instance on a
different port and comparing. More seriously, a debug server instance spun up for that same
diagnosis was never properly killed, and it sat holding a database connection open until a later
script tripped Supabase's pooler connection limit (capped at 15 in session mode). Found the leaked
process by its port, killed it, and confirmed the error cleared immediately a reminder that a
temporary debug server needs the same cleanup discipline as any other test artifact.

---

## Deployment

Getting login to actually work once the client and server were on different domains took several
real iterations a direct cross-origin call worked in a normal browser but broke in Incognito, a
plain external-URL rewrite couldn't carry POST requests, and a dynamic catch-all function file never
routed correctly on the hosting platform at all. Each dead end was found by testing the live
deployment directly rather than assuming a fix worked from a code read, and the final shape (one
plain proxy function reached through an explicit internal rewrite) was verified end-to-end login,
session persistence, role enforcement, and a real order creation against the live production URL
in both a normal browser and Incognito. Full detail of what was tried and rejected at each step is in
`docs/decisions.md`.
