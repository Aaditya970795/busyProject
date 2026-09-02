# AI Prompts Log

Keeping track of what I asked the AI to build for each task, what it came back with, and what I
ended up having to fix or push back on. This isn't a list of code changes — that's what
`plan.md` and `decisions.md` are for. This is just the "here's how the conversation actually went."

---

## Task 1 — Getting set up, database, login system

### What I asked for

I gave it the overall project — a restaurant order system replacing paper tickets, with managers
who own the menu and waiters who run orders — along with the tech I wanted to use and told it not
to swap anything out without asking me first: React + Vite + Tailwind + React Router + TanStack
Query on the frontend, Node + Express on the backend, Postgres through Supabase using Prisma (and
nothing else), and a login system built by hand with bcrypt for passwords and a JWT stored in a
cookie the browser's JavaScript can't touch. Role checks (manager vs waiter) had to happen on the
server, not just hidden/shown in the UI.

For this specific task, I told it this was task 1 of 10 and not to touch anything beyond:
1. Setting up the client and server folders, with a proper structure, and a `.gitignore`.
2. Setting up Prisma and a User table (name, email, password, role, created date), running the
   actual migration, and making sure there's one shared database connection instead of creating a
   new one all over the place.
3. Building the login API — register, login, logout, "who am I," and the two pieces of middleware
   every future feature is going to depend on: one that checks you're logged in, one that checks
   you're the right role.
4. Building the actual login/register pages, plus something that keeps track of who's logged in
   across the app, redirects you if you're not logged in, and a nav bar with an empty
   dashboard page.
5. Making it look decent with Tailwind — nothing fancy, just clean.

I also told it: ask me before installing anything or running a migration against the real database,
don't build anything beyond this list, and actually prove it works — register a manager and a
waiter, log in as both, check that "who am I" returns the right role, and check that a logged-out
person gets rejected — and show me the real output, not just tell me it works.

### What it came back with

Everything on the list got built. It actually registered both accounts, logged in as each one,
checked the role came back right, checked that logging out clears the session, and checked that a
logged-out request gets rejected — all through real requests, not just claiming it works. It also
opened an actual browser and clicked through the login page, the register page, logging out, and
getting redirected when trying to visit pages you're not supposed to see — so I could see it
actually working, not just the API responding.

### What I had to catch or fix along the way

- Setting up Prisma quietly installed a not-yet-released version instead of the stable one. It
  caught this itself, flagged it to me, and I told it to switch to the stable version.
- That same setup step dumped a bunch of AI-tool config folders into the project that had nothing
  to do with the actual app. Also caught, also removed after I said yes.
- Turned out the version of Prisma we ended up on needs an extra package just to actually connect to
  the database — it flagged this too and I approved adding it.
- It also had to switch the whole server over to the newer import/export style of writing
  JavaScript, because the code Prisma generates only works that way.
- When I first pasted in my real database password, it had an `@` symbol in it that broke the
  connection string, plus I'd accidentally pasted an extra line by mistake. I cleaned up the stray
  line myself and asked it to fix the `@` symbol issue.
- Even after fixing that, the first attempt still failed to connect — turned out my password itself
  was just wrong/outdated, not a formatting issue. Once I double-checked it in Supabase, it worked.

---

## Task 2 — Menu management and orders

### What I asked for

I asked for the actual restaurant features to go on top of the login system: managers being able to
add, edit, and archive menu items (with waiters only allowed to look, not touch), and waiters being
able to start an order for a table, add items to it with a running total that the server works out
itself. I told it not to build anything about changing an order's status yet, and to ask me before
touching the real database.

### What it came back with

Everything got built and it walked me through testing it — made two menu items as a manager, checked
that a waiter gets blocked from creating one, made an order as a waiter, added two items to it, and
checked the total came back exactly right.

### What I had to catch or fix along the way

- After I tried it myself, I found a few real problems: archiving a menu item made it vanish with no
  way to get it back, adding the same item twice created two separate lines instead of combining
  them, and prices were showing in dollars instead of rupees. I asked for all three to be fixed, plus
  a general visual cleanup.
- I also asked for a way to delete an order outright, not just archive it, in case a waiter starts
  one by mistake. That got added with a confirmation step so it's not too easy to do by accident.

---

## Task 3 — Order status and voiding items

### What I asked for

I gave it the exact rules for how an order should move through its stages — placed, accepted,
preparing, ready, served, one step at a time — and that cancelling should only be allowed early on
(placed or accepted), never once the kitchen has started. I also asked for a way to void a single
item off an order with a required reason, as long as the order isn't finished or cancelled yet. I
told it to reject anything that breaks these rules with a clear message explaining why, not just a
generic error.

### What it came back with

It built the status changes and the void feature, and tried every wrong move it could think of before
telling me it was done — skipping steps, going backwards, cancelling too late, voiding an item on a
finished order, voiding with no reason — and showed me that each one got rejected with a message
explaining why. Then it walked a real order through the whole path from placed to served and showed
the total updating correctly along the way.

### What I had to catch or fix along the way

Nothing I had to catch this time — but it caught something on its own while testing: it noticed you
could still add new items to an order that had already been cancelled, which quietly broke the whole
point of cancelling something. It fixed that itself and pointed it out to me afterward.

---

## Task 4 — Order collaborators and permission tightening

### What I asked for

I told it this was task 4 of 10, and gave it the exact gap I wanted closed: right now, any logged-in
waiter could act on any order, not just their own. I laid out the rules precisely — every order still
has exactly one primary waiter set at creation, but now any number of other waiters can be added as
collaborators, and a collaborator can do everything the primary waiter can (add lines, void lines,
change status). A waiter should only be able to act on an order they created or were added to, never
someone else's. A manager can still act on everything regardless. I asked for one shared "can this
user act on this order" check written once and reused everywhere, not copy-pasted into every route,
plus a "my orders" list for waiters. I told it the brief didn't say who's allowed to add a
collaborator, so it should pick something defensible and tell me what it picked and why. Same as
before: don't touch anything beyond this, ask before migrating the real database, and actually prove
it with real requests before calling it done.

### What it came back with

It added the collaborator table, the shared permission check, retrofitted it onto every
order-mutating route that existed so far (add line, void line, change status, archive, delete), and
added the "my orders" route. For who can add a collaborator, it picked the primary waiter or a
manager, and explained why. Then it actually proved the whole thing: created an order as one waiter,
confirmed a second unrelated waiter got rejected on every single mutating action, added that second
waiter as a collaborator, confirmed they could now do everything, confirmed a manager could act on it
regardless of any of that, and confirmed the "my orders" list picked the order up correctly — all
through real requests against the real database, and it cleaned up the test accounts and data it had
created afterward.

### What I had to catch or fix along the way

Nothing — this one went through clean on the first pass.

---

## Task 5 — Table management

### What I asked for

This wasn't a formally numbered task like the others — I just described a real gap I wanted closed:
waiters were typing a table number by hand when starting an order, and I wanted managers to control a
real list of tables instead. I asked for managers to be able to build out how many tables there are,
add more later, and remove ones they don't need — and for waiters to only be able to pick from that
list, never type their own number, with a search bar to find one quickly, and critically, only tables
that are actually free (not already occupied by another order) should show up as options. I told it
everything else should keep working exactly as it already did.

### What it came back with

It built a manager-only table list (add/remove, "remove" being a soft archive so a number can come
back later), a search bar on the table list itself, and replaced the manual number field on the order
screen with a searchable picker of only the currently-free tables. It made table occupancy work out
automatically from whatever orders are still open, instead of some status flag it'd have to remember
to flip, and it added the real server-side check too — even if someone bypassed the picker, the
server rejects an order on a table that doesn't exist or one that's already in use.

Once the migration was actually in place, I asked it to verify by adding tables as a manager and
checking the waiter side worked without breaking anything from the earlier tasks, and it did —
created several tables, confirmed a waiter couldn't create one, confirmed a duplicate table number
got rejected, confirmed a table disappeared from the available list the moment an order was opened on
it and came back the moment that order was cancelled, confirmed archiving and restoring a table
worked, and re-ran a quick smoke test on menu CRUD, adding a line, status changes, and the Task 4
collaborator permission check to make sure none of it had broken.

### What I had to catch or fix along the way

Running the actual migration turned into the biggest snag of any task so far — Prisma's own migration
tool couldn't reach the real database from this machine at all, even though a plain database
connection to the exact same address worked fine. It dug into it, ruled out the obvious things (DNS,
the database actually being down), narrowed it down to something on this machine specifically
blocking Prisma's own connection program, and proposed switching to a different Supabase connection
address plus applying the migration by hand as a workaround, which I approved.

Separately, after all that, I hit a proxy error on the client (`ECONNREFUSED`) because it had shut
down the backend server after finishing its verification and I hadn't noticed it was still off — that
one was on me for not restarting it myself, and it just started the server back up.

---

## Task 6 — Order search, filters, sort, and pagination

### What I asked for

This one came back formally numbered again — task 5 of 10 in the brief, even though it's the sixth
thing in this log since table management landed as an unnumbered task in between. I asked for the
order list to get real search, filters (status, waiter, date), sorting (placed time, status, table),
and pagination that reports the total match count — all server-side, no fetching everything into the
browser and filtering it there. I gave it the exact query param shape I wanted and pointed out the
specific problem with searching a number column as text, laying out two honest ways to handle it and
asking it to pick one and tell me why. I also told it to reuse whatever visibility rule already
existed for who can see which orders rather than invent a second one, and to add whatever indexes it
thought the new filtering/sorting would need — asking me first, since that's a real migration.

### What it came back with

It built the whole thing — search, three filters, three sort options, and pagination with a real
total count — behind the existing `GET /api/orders` endpoint, and it picked the raw-SQL-for-just-the-
table-search approach, explaining why the numeric-range alternative couldn't do genuine substring
matching. For visibility, it noticed the existing rule only lived inside the "my orders" route and
pulled it out into one shared function instead of copying it, then used that same function both for
what a waiter is allowed to see in the main list and for the new "filter by waiter" option — so a
waiter filtering for another waiter's orders can't see anything they weren't already allowed to see.
It proved this with real requests: seeded over a dozen orders across two waiters and a manager with
different tables/statuses, showed a combined search+status+sort+page-2 request returning the exact
expected slice with a consistent total, and specifically showed a waiter filtering by another
waiter's id only got back the one order they actually shared, not that waiter's whole list.

It also pointed out on its own that this makes the "my orders" tab from Task 4 redundant for waiters,
since the main list now shows them the same thing, and removed the tab rather than leave confusing
dead UI in place.

### What I had to catch or fix along the way

Nothing to fix — but it flagged something itself: applying visibility to the main order list makes a
line in `docs/architecture.md` from Task 4 out of date (it used to say listing orders was open to
everyone). It didn't rewrite that line on its own since I hadn't asked for a docs pass that turn, just
told me about it — which is exactly what I wanted.

---

## Task 7 — Bulk menu updates and CSV order export

### What I asked for

Told it this was task 6 of 10 (numbering already a step off because of table management), and asked
for two separate things: managers being able to select several menu items and apply one
price/availability change to all of them at once, with a per-item report of what succeeded and what
got rejected instead of the whole batch failing over one bad item; and a CSV export of a day's
orders, with lines, totals, and status. Told it to ask before installing a CSV library or confirm it
was hand-writing the output, and to verify with real requests — a mixed valid/invalid bulk update,
and an exported file I could actually open and check the totals against what the order detail page
showed.

### What it came back with

Built both. The bulk update processes each id independently in its own try/catch rather than one
transaction, so a bad id or a negative price only rejects the items actually affected, and it proved
that with a real batch mixing valid ids, a nonexistent one, and a negative-price attempt. For the
export, it picked a row-per-line shape with the order fields repeated, and asked upfront whether to
hand-write the CSV or install a library.

### What I had to catch or fix along the way

I told it to install a library when it asked, then caught myself and told it to use the hand-written
approach after all — it switched cleanly, undoing the install without pushback. Separately, right
after this task, I asked it to check for anything I might have missed in what it had just built, and
it found a real CSV-formula-injection hole in the export feature (a waiter's own display name or a
void reason they typed could execute as a formula when the file's opened in Excel) — explained the
exploit clearly, fixed it once I said to, and proved the fix with an actual malicious payload that
came back neutralized.

---

## Task 8 — Security audit and the fixes that came out of it

### What I asked for

This one started with me finding a real bug myself — clicking "new order" created an order with
nothing in it, no items required at all — and telling it to fix that and then check the rest of the
project for anything else I'd missed. Once it came back with a list of findings, I told it to fix all
of them, one at a time, verifying each one actually worked and didn't reopen anything before moving
to the next.

### What it came back with

Fixed the empty-order bug first (an order now needs at least one item to even exist, created
atomically with it), then did a real audit rather than a surface read — re-read every controller,
checked the actual database indexes against what the schema declared, and registered a throwaway
account live to prove the self-registration hole was real before reporting it. It came back with one
critical finding (anyone could register as a manager) and four smaller ones (missing indexes, an
order-detail endpoint that never got the visibility check the rest of the app has, a
table-double-booking race condition, and an endpoint leaking every coworker's email). It fixed all
five in the order I asked, and for the race condition specifically, it didn't just reason about it —
it fired real concurrent requests at the same table and checked the database afterward to prove
exactly one order won, not just that the response codes looked right.

### What I had to catch or fix along the way

Nothing I had to catch — but it caught something serious on its own while fixing the first item:
making self-registration safe exposed that a demoted user's existing login cookie kept their old
permissions for up to a week, because the server trusted the role stored in the token instead of
checking the database. It found this mid-fix, explained exactly why, fixed it as part of the same
pass, and proved it by demoting a test account and confirming their old cookie lost access
immediately, no re-login needed.

---

## Task 9 — No more self-registration: admin/manager/waiter account provisioning

### What I asked for

After the security fixes, I asked the obvious follow-up: if nobody can self-register as a manager
anymore, how does a manager account ever get created? I went back and forth with it on the actual
design — it suggested a few standard bootstrap patterns, then I described what I actually wanted: a
real admin tier above manager, where admin creates managers (and can create waiters too), a manager
can only create waiter accounts, and I raised the concern myself that self-registration for waiters
was also a problem since anyone who found the site could make themselves an account. It agreed and
we settled on removing public registration entirely.

### What it came back with

Built a real three-level role hierarchy (waiter/manager/admin) with one shared rank-check helper
reused everywhere instead of scattered exact-role comparisons, removed the register endpoint and page
completely, and added account-creation and role-change endpoints gated the way we'd agreed — a
manager can create a waiter, only admin creates a manager or changes anyone's role, and admin itself
is never assignable through the API at all. For bootstrapping the very first admin, it wrote a
one-time script, asked me which account should become admin, ran it once directly against the
database, and deleted the script immediately after — never touched over HTTP. It proved the whole
thing with real accounts: a manager blocked from creating another manager, a waiter blocked from
creating any account, a manager blocked from the role-change endpoint, and admin still able to do
everything a manager could on top of the new account-management powers.

### What I had to catch or fix along the way

Nothing to fix, but there was real back-and-forth on the design itself before any code got written —
this wasn't a case of it just picking an approach on its own, I was actively deciding the shape of
the account model with it across a few messages, which is different from most earlier tasks where I
handed over a spec and it built to it.

---

## Task 10 — Password reset, and not losing the password you just set

### What I asked for

Asked what happens if a waiter or manager forgets their password, given there's no email system to
send a reset link. It laid out the tradeoff clearly rather than just building something — recommended
the same authority model as account creation (whoever can create an account can reset its password)
instead of anything requiring email infrastructure, and I agreed. Separately I asked a second,
related question first without wanting anything built yet — what if the admin or manager who just
set someone's password loses track of it before sharing it — and it told me not to store the password
anywhere retrievable, even though I was half-fishing for whether that made sense, and instead
recommended showing it once on a success screen with a copy button, plus pointing out that "reset it
again" is already a full solution to a lost password. I then asked it to actually build that second
part.

### What it came back with

Built the password-reset endpoint following the same manager-resets-waiter, admin-resets-manager-or-
waiter rule as account creation, reusing the same permission check rather than writing a new one. For
the UX fix, the create-account form now shows a dismissible card with the name/email/password and a
copy button after a successful create, instead of clearing the form immediately. It tested the reset
endpoint with real accounts (a manager resetting a waiter's password, a manager blocked from
resetting another manager's, admin blocked from resetting even their own), and for the UX fix
specifically, it opened an actual browser, filled out the form, clicked copy, and pasted the
clipboard contents into another field to prove the copy button worked — not just that the card
rendered.

### What I had to catch or fix along the way

Nothing — both parts went through clean, and it correctly declined to overbuild anything (no email
sending, no token-based reset flow) beyond what the app's actual infrastructure could support.

---

## Axios migration (cross-cutting, not a numbered task)

### What I asked for

Separately from any single task, I asked it to go back through everything already built and replace
every plain `fetch` call on the client with axios. I also asked directly whether it was using an axios
interceptor to attach the JWT to outgoing requests.

### What it came back with

It swapped every API call over to a shared axios instance instead of scattered `fetch` calls, and
answered the interceptor question straight: no interceptor, because there's nothing to inject — the
JWT lives in an httpOnly cookie, and axios is already configured with `withCredentials: true`, so the
browser attaches the cookie automatically on every request the way it always did before axios existed.

### What I had to catch or fix along the way

Nothing to fix — this was a pure refactor with no behavior change, and it confirmed that with real
requests rather than just asserting the swap was safe.

---

## Task 11 — Dashboard

### What I asked for

A dashboard brief (numbered task 7 of 10 in the original wording, landing as Task 11 in this log for
the same renumbering reason earlier tasks note): a manager-facing screen summarizing how the
restaurant is doing — headline counts, revenue, breakdowns, and a way to see what's trending, backed
by real aggregate queries instead of the client fetching every order and computing numbers itself.

### What it came back with

One summary endpoint powering headline stat cards (open orders, placed/served today with a
vs-yesterday delta, revenue with an average order value), an orders-by-status breakdown, an
orders-by-waiter leaderboard, today's top sellers, a 14-day orders/revenue trend chart, and a recent
orders feed — each row a real link into that order's detail page. Gated the whole endpoint to manager
and above, since none of it is information a waiter needs for their own job.

Afterward I asked for the dashboard to be enhanced further and pointed out the gap directly: "for
waiter dashboard show something there not just waiter can't see the dashboard we can show some other
dashboard there." It built a genuinely different waiter-facing view instead of a locked-out page —
their own open-order count, what they placed/served today, and their open orders sorted oldest-first —
built entirely from the "my orders" endpoint Task 4 already exposed, no new backend surface needed
for it.

### What I had to catch or fix along the way

Nothing to fix — verified live in the browser with real data (stat cards checked against the actual
order set, the chart-metric toggle switching between orders and revenue, the waiter view showing a
different waiter's own orders correctly) rather than just trusting the numbers looked plausible.

---

## Task 12 — Fully responsive UI pass

### What I asked for

"make the UI fully Responsive for all type of devices."

### What it came back with

An audit of every page — first grep for every `<table>` and every fixed-width form field before
touching anything — which turned up the nav bar as the single most broken thing on mobile (five links
plus brand plus user info plus logout, all in one unwrapped row), fixed first since a broken nav makes
every other page unreachable regardless of how responsive its own content is. Every table then got
wrapped in its own horizontally-scrolling container, header rows and a handful of fixed-width form
fields got `flex-wrap`/full-width treatment, and it verified the result in a real browser at phone and
tablet widths rather than just trusting the Tailwind classes were correct on paper — the window-resize
tool wasn't actually shrinking the browser viewport in this environment, so it improvised by embedding
the app in same-origin iframes sized to real device widths to get a genuine narrow-viewport render to
screenshot.

### What I had to catch or fix along the way

Nothing I had to catch — but it caught something itself during that browser verification: the
create-item form on the Menu page used a plain `flex` row with no wrap, so at phone width the item
name field was getting squeezed down to just a few characters wide instead of the price field
stacking underneath it like every other form on the page already did. Found by actually looking at the
rendered mobile layout, not by reading the Tailwind classes, fixed the same way the other forms already
worked, and re-verified after the fix.

---

## Task 13 — Order audit timeline

### What I asked for

A detailed brief (numbered "task 8 of 10," landing as Task 13 here for the same renumbering reason
Tasks 6 and 7 already noted) for a permanent, append-only history on every order: every status
change with who made it, every line added or voided with its reason, and any free-text notes —
explicitly forbidding any code path from ever updating or deleting one of these rows, including for
a manager. I gave the exact `OrderEvent` shape I wanted, told it to wire the logging into the
existing status/line-add/line-void routes using `$transaction` so the mutation and its audit entry
commit together, asked for a notes endpoint and a timeline endpoint, a frontend activity feed, and —
since the dashboard from Task 11 had a documented approximation for "served today" — told it to go
back and switch that to the new event log as part of this same task, and tell me explicitly that it
did. No alerts yet, and to ask before running the migration.

Partway through, I checked in on progress ("have you completed audit timeline?? if not then do
it") after it had only gotten as far as the schema, the migration, and the logging helper — it
answered honestly that it wasn't done yet and kept going rather than claiming otherwise.

### What it came back with

Added the `OrderEvent` model and `EventType` enum, asked before running the migration, then wired
event-logging into `createOrder`, `addLine`, `voidLine`, and `updateStatus` — each writing its audit
row in the same transaction as the change itself. Added the notes and timeline endpoints, a
timeline feed on the order-detail page with a note form, and switched the dashboard's `servedToday`
and `servedPerDay` over to the new event log as asked, explaining why that actually fixes the old
approximation (an order can only ever become "served" once, so that event's own timestamp is the
real moment, not a guess). Proved the whole thing with one real order: created it, added a line,
voided a line, walked it through every status to served, left a note, then pulled the timeline and
showed all eight events in the right order with the right actor and detail — and pulled the dashboard
summary afterward to show `servedToday` and the day's revenue matched exactly what that one order
actually served, with the voided line correctly excluded.

### What I had to catch or fix along the way

Nothing to fix — a mid-task status check, answered honestly rather than assumed finished, and the
rest went through clean.

---

## Task 14 — Slow-order alerts

### What I asked for

A brief numbered "task 9 of 10" and marked as the last feature task before deployment. An order open
too long without reaching Ready should show up in an alerts area with a nav count badge; a waiter or
manager can acknowledge one to clear it, and it should come back if the order is still stuck well
past a second, separate threshold. I gave the exact `where`-clause shape I wanted (two cutoffs
computed in JS, the actual filtering left to Postgres, not a fetch-and-filter-in-JS), told it to make
both thresholds environment variables with defaults and document them in `.env.example`, asked for
the badge to poll on some reasonable interval it could pick and justify, and told it to decide for
itself — with reasoning either way — whether acknowledging belongs in the Task 13 audit timeline. Ask
before migrating, no deployment work, and verify for real: simulate the thresholds passing by
directly editing a test order's timestamps instead of actually waiting, and show an order that
reaches Ready in time never alerts at all.

### What it came back with

Added the `alertAcknowledgedAt` column, a shared `alertingWhere()` helper reused by both the new
`GET /api/alerts` and the nav badge's query, and `POST /orders/:id/acknowledge-alert` behind the same
authorization every other order mutation uses. Picked 30-second polling for the badge, matching the
dashboard's own refresh interval, and had the alerts page invalidate that same query on acknowledge
so the badge doesn't sit stale for up to 30 seconds after someone actually clears one. For the
timeline question, it decided against logging acknowledgements there — its reasoning: the timeline
records what happened to the order itself, and acknowledging an alert doesn't change the order's
status, lines, or bill, it's a record of staff attention, not order history.

Verified with one order backdated 20 minutes past the default threshold (it appeared in `/alerts`), a
second order pushed to Ready well inside the threshold (it never appeared at all), acknowledging the
first (it disappeared immediately), then backdating its acknowledgement past the reappear window (it
came back). Also checked authorization on the way: a waiter's alert list only showed their own
orders, and a waiter got a 403 trying to acknowledge someone else's.

It also caught something unrelated to the feature itself while adding the new env vars to
`.env.example`: `server/.gitignore`'s `.env.*` pattern had been excluding that file from git since
the very first commit, despite the README telling every new developer to copy it. Flagged it, I said
fix it, and it narrowed the pattern and committed the file that should have been there all along.

### What I had to catch or fix along the way

Nothing in the feature itself — but while writing this up, it caught a real mistake spanning its own
last two documentation passes: a string of dropped em-dashes across the Task 11, 12, and 13 entries in
`plan.md` and `decisions.md`, plus one in the README's own Task 13 row — each one turning a sentence
into a run-on that didn't actually parse (one example literally read "including for a manager an audit
trail that can be edited" with no dash between the two halves). Found by rereading its own prior work
line by line rather than by me pointing it out, and fixed everywhere it turned up before adding this
task's own entries.

---

## Task 14, follow-up 2 — auto-clearing abandoned orders

### What I asked for

I pointed at a real screen showing "Critical — open 2814m" and said that number needs to read like
actual time (seconds/minutes/hours as appropriate), and asked for a genuinely automatic feature on
top: an order stuck past 45 minutes to an hour should get cleared on its own so the table becomes
available again, without anyone having to click anything.

### What it came back with

Fixed the duration display with a proper formatter that picks minutes, hours-and-minutes, or
days-and-hours depending on magnitude. For the automatic clearing, it flagged a distinction before
building anything: "deleted" would destroy the order's whole Task 13 audit history along with it, so
it built this as an automatic cancel instead — same mechanism as the existing manual "Clear table"
button, which already achieves the actual goal (table free, available again) without losing the
record. It also scoped auto-clearing to placed/accepted orders only, explaining that a preparing
order can't be safely auto-cancelled since the kitchen has already started on it — that one keeps
alerting until a person deals with it instead. Built as a background check running once a minute
inside the existing server process (no new job-queue infrastructure), and made the audit event's
actor field optional so the system itself can log what it did, with the timeline showing "Automatically
cancelled" instead of a person's name.

Verified by backdating a placed order and a preparing order both past the 45-minute default, running
the sweep, and confirming the placed one got cancelled (table freed, timeline entry present with a
null actor) while the preparing one was left alone and kept alerting. Running the sweep for real also
auto-cancelled four genuinely stale orders left over from much earlier testing sessions that had been
sitting untouched in the database for days — the sweep working correctly on actual old data, not just
a freshly built test case.

### What I had to catch or fix along the way

Hit a real environment snag partway through: the Prisma migration for the actor-field change failed
twice — once with `npx` trying to install and run the release-candidate version of Prisma instead of
the project's pinned stable one (the exact issue from decision #1, resurfacing through `npx`'s own
resolution rather than anything about this project), and once with the database genuinely unreachable
from this machine for a few seconds (the same kind of connectivity blip noted in decisions #18–19).
Neither got waved through — the RC install was killed before it could run anything, confirmed the
local dependency was still correctly pinned at 7.10.0, and switched to calling the local `prisma`
binary directly instead of through `npx` to make sure it couldn't happen again. The database blip
cleared on a retry.

---

## Task 15 — Staff deactivation, the auto-clear worry, and toast notifications

### What I asked for

Three things in one request, with an explicit instruction to explain the approach and wait for a
go-ahead before writing any code. First, a full audit of everything built so far against industry
standards and scalability. Second, an option in Team to remove a waiter or manager when they leave,
that either an admin or a manager could use. Third, a real worry about the Task 14 auto-clear sweep:
what happens to a customer who's still physically waiting when their order hits 45 minutes and gets
cancelled anyway asked whether that could be handled better, or whether there's a better way, not
told what to build. Also asked for a toast notification to the responsible waiter when their order
gets auto-cancelled, explicitly ruling out WebSockets and naming `react-toastify` directly.

I pushed back twice for more clarity before letting it start: once because the auto-clear explanation
was too abstract to actually picture, and once to confirm toastify was purely a display library and
polling was still going to be the mechanism underneath it — wanted to understand both before saying
go.

### What it came back with

For the audit: a categorized list of what's solid (bcrypt+JWT-in-httpOnly-cookie, role re-checked
from the database every request, real transactions where they matter, consistent indexing) against
real gaps left deliberately unfixed for now (no rate limiting, no validation library, no request
logging, the single-process alert sweep) plus one finding it flagged as relevant to the very next
task: the auth cookie's `SameSite=Lax` setting assumes client and API end up on the same registrable
domain, which matters once deployment actually happens.

For deactivation: checked the schema before proposing anything and found a real delete isn't just a
bad idea, it's impossible — every order a person's touched references them with no cascade rule, so
the database itself would reject deleting anyone with real order history. Built as `isActive`
instead, matching the exact pattern already used for Tables and MenuItems, reusing the existing
authority rules, and adding two new guards (can't deactivate yourself, can't deactivate the last
manager) explained by mirroring an identical existing guard on demoting the last manager.

For the auto-clear worry, it agreed the concern was valid and proposed exactly what I'd been
thinking — exempt any order that's ever been acknowledged but also named the honest trade-off
before I had to ask: a single acknowledgment with no real follow-through means an order can sit
open forever. It didn't try to solve that with more logic, pointing out the critical-tier escalation
and the repeat-alert tag already keep a stuck order visible to a manager either way.

For notifications: a small `Notification` table, written in the same transaction as the
auto-cancellation, polled every 30 seconds on the same rhythm as the alerts badge, displayed with
`react-toastify` as asked. Asked permission before installing the package and before running the
migration, same as every other time.

Verified all three for real: deactivated Bob and confirmed his existing session died immediately and
a fresh login attempt got a clear "deactivated" message, confirmed he dropped out of the default
user list and reappeared with `include_inactive=true`, reactivated him and confirmed he could log in
again. Tested the last-manager guard with a temporary admin account created specifically for this
(deleted afterward) since the real admin's credentials aren't available in this session. Backdated an
acknowledged order and an unacknowledged one both past 45 minutes and ran the sweep directly only
the unacknowledged one got cancelled, and a real notification was written and delivered through the
unread-notifications endpoint for it.

### What I had to catch or fix along the way

Two real ones, both self-caught. First, a login request returned a bare 500 partway through
verification turned out to be an already-running dev server process that hadn't picked up a
schema change, not a code bug; found by spinning up a completely fresh instance on a different port
to confirm the same code worked correctly there, then restarting the stale one. Second, and more
serious: a debug server instance started earlier for that same diagnosis was never actually killed
(a background-job cleanup attempt silently failed), and it sat there holding a database connection
open until a later cleanup script tripped Supabase's pooler connection limit (`max clients reached in
session mode`, capped at 15). Found the leaked process by port, killed it for real, and confirmed the
connection error cleared immediately after a good reminder that a temporary server instance spun up
for debugging needs the same cleanup discipline as any other test artifact.


