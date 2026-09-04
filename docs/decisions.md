# Decisions

This is a log of the actual choices I made along the way, where more than one option made sense and
I had to pick one. Not everything I did during the build, just the stuff worth remembering why later.
Numbers keep going up across tasks — I won't renumber old ones, I'll just add a "Later reversed"
note under one if I end up changing my mind down the line.

---

1. Went with the stable version of Prisma instead of what got installed by default


When I ran `prisma init`, it quietly installed a release-candidate version of Prisma (8.0.0-rc.12)
that didn't even match the client library version it also installed. I switched both back to the
plain stable version, 7.10.0.


---

2. Deleted the AI-assistant folders that Prisma auto-created

Setting up Prisma also dropped a bunch of folders into the project — `.claude`, `.cursor`,
`.agents`, `.devin` — plus a script that runs every time you install packages. I deleted all of it.


---

3. Had to add an extra package just to let Prisma connect to the database

Turns out the new version of Prisma doesn't let you just point it at a database URL anymore — you
have to give it an actual "adapter" package to make the connection. I added `@prisma/adapter-pg`
along with the regular `pg` package for this.


---
4. Switched the server to use `import`/`export` instead of `require`

Node projects usually default to the older `require()` style. I switched the server over to the
newer `import`/`export` style instead.


---

5. Registering doesn't log you in automatically

After you fill out the register form, it just takes you to the login page — it doesn't sign you in
right away. You have to type your new password in and log in like normal.

---

6. Kept the price check for menu items in the code, not the database

I could have made the database itself refuse a negative price. Instead I check it in the code before
anything gets saved. Doing it in the database would have meant hand-editing the migration file every
time, which felt fragile — the code was already the place every other rule like this lived, so I
kept it consistent.

---

7. Adding the same item twice combines it into one line instead of two

If a waiter adds "2x Garlic Bread" and then adds "1x Garlic Bread" again later, it now shows up as
one line with a quantity of 3, not two separate lines. This only happens if the price hasn't changed
since the first time it was added — if the price changed in between, it stays as two separate lines
on purpose, so the order still shows exactly what was charged at each point in time.

---

8. Archived menu items can be seen and brought back, not just hidden forever

A manager can flip a switch to see items they've archived, and un-archive one if they didn't mean to
hide it. Before this, archiving an item made it disappear with no way to find it again, which felt
like a trap.

---

9. Switched the currency symbol to rupees

Prices now show with a ₹ symbol instead of a $ sign, formatted the way Indian currency is normally
written.

---

10. Orders can be deleted, not just archived

A waiter can fully delete an order if it was started by mistake, on top of the existing archive
option. Deleting asks for a confirmation first, since it can't be undone — archiving already existed
for cases where you want to hide something but keep it around.

**Later reversed/superseded**: a pre-deployment review found the actual `DELETE` route never
enforced "started by mistake" at all — it could be called at any status, including after the order
was fully served, and did a real `prisma.order.delete()` that cascaded away the order's entire Task
13 audit trail. See decision #76, which fixes both problems: deletion is now genuinely restricted to
before preparing starts, and never actually erases the order or its history from the database.

---

11. Order status can only move forward one step at a time, never skipping ahead or going backwards

An order has to go placed, then accepted, then preparing, then ready, then served, in that exact
order, one step at a time. You can't jump from placed straight to ready, and you can't move
backwards once you've gone forward.

---

12. Cancelling only works early on, never once the kitchen has started

An order can only be cancelled while it's still placed or accepted. Once it moves to preparing, it
can't be cancelled anymore — at that point the food is already being made.

---

13. Blocked adding new items to an order that's already been served or cancelled

I noticed while testing that you could still add items to an order after it was cancelled, which
didn't make sense — why would you add something to an order that's already dead? I closed that off
so items can only be added while the order is still open.

---

14. Kept collaborators addable only by the primary waiter or a manager

The brief didn't say who's allowed to add a collaborator to an order. I picked the primary waiter or
a manager — not any collaborator, and not any waiter — since letting anyone attach themselves (or
anyone else) to someone else's order felt like the wrong default.

---

15. `GET /orders/mine` stayed open to managers too, instead of blocking them

A manager can never actually be a primary waiter or a collaborator, so this route just comes back
empty for them. Blocking it with a 403 would have been extra code for a route that's already
harmless to leave open — the frontend just doesn't bother showing the "my orders" tab to managers.

---

16. Removing a table is a soft archive, not a real delete

Same reasoning as menu items — a manager can un-remove a table if they didn't mean to, and it keeps
the table's number consistent for any old orders that used it. Re-adding the same table number
afterward restores the same row instead of erroring on the number being "already used."

---

17. The Table list has no foreign key relationship to Order

`Order.tableNumber` is still just a plain number, exactly like before this task. Making it a real
relation would have meant backfilling every existing order with a matching Table row before the
migration could even run. Keeping them separate meant the whole feature could be added without
touching the Order table's shape at all — whether a table is occupied gets worked out by comparing
numbers in the code instead.

---

18. Had to switch the database connection string from Supabase's direct connection to its "session
pooler" one

Partway through Task 5, Prisma's own migration tool stopped being able to reach the database from
this machine, even though a plain database client could connect to the exact same URL just fine.
Turned out to be something on this machine blocking Prisma's separate connection program
specifically, not a real database problem. Switching to Supabase's pooler connection (a different
address that also happens to dodge the IPv6-only issue the direct connection has) fixed it for the
actual app, and I kept it that way going forward.

---

19. Applied one migration by hand instead of through Prisma's own migration command

Even after switching to the pooler connection, Prisma's migration tool still couldn't get through on
this machine (same blocking issue as above), so the exact SQL Prisma would have generated got run
straight against the database with a plain database client, then recorded in Prisma's own migration
history table by hand so its tooling wouldn't get confused later. `prisma migrate status` confirmed
everything still lined up afterward.

---

20. `GET /api/orders` now enforces the same visibility a waiter already had on `/orders/mine`

This wasn't asked for as a separate thing — the brief for order search said the list should "respect
existing visibility," and the only existing visibility rule in the app was the primary-waiter-or-
collaborator one from Task 4's "my orders" route. Applying it here means a waiter's search results
can never include an order they have no relationship to, even if they explicitly filter for it.

---

21. Table-number search uses one raw SQL query instead of a numeric-range trick

`tableNumber` is an integer, and Prisma's "contains" filter only works on text columns. The other
honest option was computing numeric ranges to approximate a prefix match, but that still can't do a
real substring match (searching "1" wouldn't find table 21), and gets fiddly fast. One raw,
parameterized query that casts the column to text and does a genuine substring match was more honest
about what "search" actually means here, and it stays isolated to a single query instead of touching
the rest of the filtering/sorting/pagination logic.

---

22. Removed the "All orders / My orders" tabs from the orders page

Once `GET /api/orders` started applying the same visibility rule a waiter's "My orders" list already
used, the two tabs would show a waiter the exact same set of orders under two different labels. Kept
the `/orders/mine` route itself (removing a working endpoint wasn't asked for), but the tab toggle in
the UI was just confusing dead weight at that point, so it came out in favor of the one filterable
list.

---

23. Bulk menu update processes each id independently, never inside one transaction

A `prisma.$transaction` covering the whole batch would roll every item back the moment one of them
failed. The actual requirement was the opposite — partial success, with a per-item report of what
happened — so each id gets its own try/catch in a plain loop instead.

---

24. Hand-wrote the CSV export instead of using a library

Went back and forth on this one — briefly installed `csv-stringify`, then switched to a small
hand-rolled escape-and-join helper instead once it was clear the data was simple enough not to need
a dependency for it (flat rows of plain values, nothing nested or streamed).

---

25. CSV export: one row per order line, order fields repeated, and the same visibility as the order list

Order-level fields (id, table, status, waiter, placed time, total) repeat on every line's row rather
than appearing once — the simplest shape that still opens correctly in a spreadsheet. An order with
no lines yet still gets a single row with blank line-fields, so it's never silently missing. A
waiter's export only includes orders they're attached to, same rule as everywhere else; a manager
gets every order for that date.

---

26. Neutralize CSV cells that start with a formula-trigger character

A cell starting with `=`, `+`, `-`, `@`, or a tab gets a literal `'` prefixed onto it before writing.
Found via a security pass on the export feature (proven with an actual `=HYPERLINK(...)` payload
sitting in a waiter's own display name), not a hypothetical — without this, a low-privilege user's
own name or a void reason they typed could execute as a formula when a manager opens the exported
file in Excel or Sheets.

---

27. An order can't be created without at least one item

`POST /api/orders` now requires `menu_item_id` and `quantity` up front and creates the order together
with its first line in one nested Prisma write, so the two can never land as separate statements.
Before this, a bare `{ table_number }` request created a real, empty order that just sat there —
found by testing, not by inspection.

---

28. First fix for self-registration: strip `role` from the public register endpoint

Made every new account a waiter regardless of what the request body asked for, closing the immediate
hole with a one-line change. **Later reversed/superseded**: Task 9 removed public registration
entirely — this decision only lasted until the very next task, once it was clear that patching the
one field didn't address how a manager account should ever legitimately get created.

---

29. `requireAuth` re-reads the user's role from the database on every request, not from the JWT

The token used to carry `role` as a claim, trusted as-is. That meant a role change (impossible before
Task 9, but very possible after) wouldn't take effect until the old token expired — up to 7 days —
and a deleted user's token kept working on every route except `/me`, which did its own DB check.
Found while verifying the self-registration fix, fixed the same way: one database lookup per request
instead of trusting the token's payload.

---

30. Added the four indexes the audit found missing

`Order.primaryWaiterId`, `Order.tableNumber`, `OrderLine.orderId`, `OrderCollaborator.waiterId` — all
foreign-key columns actually filtered on in the app's most common queries, none of them indexed.
Nothing was wrong about the queries themselves, just an easy thing to miss until it's slow.

---

31. `GET /api/orders/:id` now requires the same access check as every mutating endpoint

It had been deliberately left open since Task 4 ("this task only tightened who can change something,
not who can look at one"), and nothing since had revisited it even after Task 6 added the same
visibility rule to the list and export endpoints. Closed the inconsistency rather than leave it as a
known gap.

---

32. Closed the table-double-booking race with a Serializable transaction, plus a safety-net catch on table creation

The occupancy check and the order `create` used to be two separate, unlocked statements. Wrapped both
in one `prisma.$transaction` with `Serializable` isolation so Postgres itself detects two overlapping
requests and fails the loser with a clean 409 instead of letting both succeed. Proved it with real
concurrent requests, not just reasoning about it — and found along the way that this driver
(`@prisma/adapter-pg`) surfaces the conflict as a raw SQLSTATE `40001`, not Prisma's documented
`P2034`. Table creation got the equivalent-but-lower-stakes fix: a `P2002` catch, since the database's
own unique constraint already prevented the actual duplicate, it just wasn't turned into a clean
error before.

---

33. `GET /api/users` only includes email addresses for a manager or admin

Every authenticated user still needs this endpoint (it powers the collaborator picker and the waiter
filter dropdown), but neither of those features ever needed a coworker's email — only `id`/`name`/
`role` do. Tightened to least privilege rather than leaving it open to everyone just because it
already was.

---

34. Left email enumeration on account creation alone

`POST /api/users` still returns a distinct "Email already registered" for a duplicate. Hiding that
is the standard mitigation for password-reset flows, not account-creation ones — most real products
confirm an email's already in use at signup — and there's no path from that response to an actual
account compromise. A deliberate call, not an oversight.

---

35. Added a real `admin` role instead of further tightening the manager/waiter check

Once self-registration as a manager had to close for good, *something* had to gate who becomes a
manager. Rather than hard-code "only a manager can promote someone" (circular — the first manager
would still need to come from somewhere), a rank above manager made the hierarchy make sense: admin
manages managers and waiters, manager manages only waiters.

---

36. No account is ever created or promoted to admin through the API, at all

Not even by another admin. The sole admin account's role was set once, directly against the database,
by a script written for that purpose and deleted right after. Zero HTTP surface for the top of the
hierarchy means there's nothing to find, guess, or race — the tradeoff is that recovering a lost
admin account needs the same direct database access, not an API call.

---

37. A manager can create only waiter accounts; only admin creates managers or changes anyone's role

Mirrors the rank rule everywhere else in the app. `PATCH /api/users/:id/role` moved from
manager-gated to admin-gated as part of this — a manager could previously promote a waiter to
manager themselves, which no longer fit once "who becomes a manager" was meant to be admin's call.

---

38. Password reset follows the exact same authority rule as account creation

Reused `canManage(callerRole, targetRole)` rather than writing a second permission check — a manager
resets a waiter's password, an admin resets a manager's or a waiter's, nobody resets an admin's this
way. This is the app's whole answer to "forgot password," since there's no email infrastructure to
send a reset link.

---

39. The create-account form reveals the new password once, with a copy button, instead of clearing it immediately

The form used to reset right after a successful create, which meant a missed copy or a closed tab
lost the password before it reached the new hire, with no way to see it again (correctly — it's never
stored anywhere retrievable). Now it stays on screen in a dismissible card, explicitly labeled as a
one-time reveal, the same pattern AWS/GitHub use for access keys. If it still gets lost, resetting the
password again is free and was already built — no separate recovery path was needed.

---

40. Replaced every `fetch` call on the client with axios, and didn't add a request interceptor for
    the auth token

The JWT lives in an httpOnly cookie, never in JavaScript-readable storage, and axios is already told
`withCredentials: true` so the browser attaches that cookie to every request on its own. An
interceptor exists to inject something the app itself is holding onto (e.g. a token in memory or
`localStorage`); there's nothing here for one to inject.

---

41. The dashboard summary endpoint is manager-and-above only; a waiter gets a different view built
    from an endpoint that already existed

Open orders, today's revenue, and a per-waiter leaderboard all read as a management view, not
something a waiter needs. Rather than send a waiter a cut-down version of the same payload, the
waiter-facing dashboard is built entirely from `GET /orders/mine`, which Task 4 already exposed —
no new endpoint needed for it.

---

42. Picked Recharts for the dashboard's charts

Wanted a bar chart and a line chart that resize themselves to their container instead of a fixed
pixel size, since the same dashboard needed to keep working once the responsive pass (Task 12)
started resizing the cards around them. Recharts' `ResponsiveContainer` does exactly that, and it's
a plain React component API instead of something that needs manual DOM/canvas wiring.

---

43. "Served today" and the 14-day trend are approximated from order status and `updatedAt`, not a
    real event log

There's no table recording *when* an order changed to each status, so "served today" means "status
is currently `served` and it was last touched today." An order served yesterday that later gets
archived and unarchived today would be miscounted — a rare, acceptable gap for now, documented in
the code as a known limitation rather than silently accepted.

---

44. The dashboard refreshes itself every 30 seconds instead of needing a manual reload

A dashboard is read-mostly and only useful if the numbers on it are close to current. TanStack
Query's `refetchInterval` handles this without hand-rolling a polling loop, and 30 seconds felt
frequent enough to feel live without hammering the aggregate query on every render.

---

45. Mobile nav collapses behind a hamburger button below the `md` (768px) breakpoint, instead of a
    bottom tab bar or an always-visible condensed nav

Matches the one existing nav bar's structure most closely — brand, links, user info, and logout all
already lived in one row, so hiding that row behind a toggle below `md` and showing a stacked
equivalent in a drawer needed no new navigation model, just a second rendering of the same links.

---

46. Tables scroll horizontally on narrow screens instead of collapsing into stacked cards

A dedicated mobile card layout for every table (Menu, Orders, Order Detail, Team) would have meant a
second, parallel markup structure per table to keep in sync with the desktop one forever after.
Wrapping the existing `<table>` in a scrollable container with a `min-width` keeps exactly one markup
structure per page — a phone user scrolls sideways to see every column, which is a normal, understood
pattern, rather than the app inventing a different information layout just for small screens.

---

47. Every audit-trail write happens inside the same `$transaction` as the change it records

A status update, a line being added, and a line being voided each now write an `OrderEvent` row in
the same transaction as the mutation itself, rather than as a follow-up statement after. The two
either both commit or both roll back — there's no window where the order changed but the event log
doesn't know it, or vice versa.

---

48. `OrderEvent` rows can only ever be created — no code path updates or deletes one, ever

Enforced by convention, not a database trigger: every write to this table goes through one helper
(`logEvent`), and nothing in the app calls `.update`/`.delete`/`.deleteMany` on it, including for a
manager acting on someone else's order. An audit trail that can be edited or removed after the fact
isn't an audit trail — the whole point is that it's the one thing in the app nobody can quietly
rewrite.

---

49. A "line added" event describes what was actually added, not the line's new total

Adding "1x Garlic Bread" to an order that already has "2x Garlic Bread" on it merges into a single
line with quantity 3 (an existing rule from Task 2). The event logged for that action says "Garlic
Bread x1" — what this specific action added — not "Garlic Bread x3," which would make the timeline
read as if 3 were added twice. The order's current line quantities are always visible on the order
itself; the timeline's job is to say what happened at each step, not repeat the running total.

---

50. The order's first line (created together with the order itself in Task 2) also gets a
    `line_added` event

The brief's wording focused on the existing `POST /orders/:id/lines` route, but an order's very
first item is still a line being added, just inside `createOrder` instead of a separate request. Not
logging it would leave a real gap at the very start of every order's timeline — the first thing that
happened to it missing from its own history.

---

51. The new note endpoint writes its `OrderEvent` row directly, not through the transactional
    mutation paths above

Adding a note isn't paired with any other write the way a status change or a line edit is — it's
already a single, standalone statement, so wrapping it in `$transaction` would add nothing. It still
goes through a plain `prisma.orderEvent.create` (never `.update`/`.delete`, same hard rule as
everywhere else), just without a transaction wrapper it doesn't need.

---

52. Dashboard's `servedToday` and `servedPerDay` now read off the order's status-changed-to-served
    event, not `orders.updatedAt`

This was a documented approximation from Task 11, kept until there was a real event log to read
from instead. `served` is a terminal status, so an order can only ever get exactly one status-change
event with `newValue: "served"` — using that event's own timestamp is the actual moment the order
became served, not a guess, and it's no longer thrown off by an order being archived and unarchived
later (which used to bump `updatedAt` and could miscount a day-old order as served today).

---

53. Acknowledging an alert is not logged to the Task 13 audit timeline

The timeline records things that happened *to the order* — its status, its lines, notes staff left
about it. Acknowledging an alert doesn't touch any of that; it's a record of who's paying attention
to a slow order, not a change to the order itself. Adding it would also mean extending `EventType`
for a feature that was explicitly briefed as its own task, separate from Task 13. The
`alertAcknowledgedAt` timestamp on the order already answers "was this acknowledged, and when" for
anyone who needs it — nothing is silently lost by leaving it out of the timeline.

---

54. The two alert thresholds are read from `process.env` at call time, not cached at startup

`SLOW_ORDER_MINUTES` and `ALERT_REAPPEAR_MINUTES` are re-read on every request that needs them
(`Number(process.env.X) || default`), the same `|| default` pattern already used for `PORT`. In
practice these only change via a real deploy/restart, but there's no cost to not locking the value in
any earlier than it has to be, and it avoids a module-load-order dependency on when `.env` gets read.

---

55. The alert filter stays a `where` clause, not a fetch-then-filter-in-JS

Both cutoff timestamps (`SLOW_ORDER_MINUTES` and `ALERT_REAPPEAR_MINUTES` ago) are computed once in
JS and hand straight to Prisma as `createdAt`/`alertAcknowledgedAt` comparisons, the same
`{ notIn: [...] }` and `OR` shapes already used elsewhere in the order queries. The database does the
actual filtering — this app never pulls every open order into memory just to decide which ones are
slow.

---

56. The nav alert badge polls every 30 seconds; acknowledging invalidates that same query directly

Matches the interval the dashboard (Task 11) already uses for its own auto-refresh, and there's no
websocket/SSE channel in this app to push updates instead — polling is the option that needs no new
infrastructure. A 30-second-stale badge count is a fine tradeoff for a restaurant floor, but waiting
up to 30 seconds for the badge to update right after someone acknowledges an alert would feel broken,
so the alerts page invalidates the shared `["alerts"]` query key on a successful acknowledge instead
of waiting for the next poll.

---

57. Fixed `server/.gitignore` excluding `server/.env.example` from git entirely, since Task 1

Its `.env.*` pattern matched `.env.example` too, so the file has existed on disk and been referenced
by the README ("fill in server/.env using server/.env.example as a guide") since the very first
commit, but was never actually tracked — anyone cloning the repo fresh would have nothing to copy
from. Narrowed the pattern to just `.env` and `.env.local` (matching the root `.gitignore`) and added
the file to git. Found while documenting this task's two new env vars in it.

---

58. "Clear table" on an alert reuses the existing cancel-order transition instead of a new endpoint

Clearing a table when an order was never accepted is just cancelling it — the rule for when that's
legal already exists (Task 3: only while `placed`/`accepted`, never once `preparing` has started) and
already frees the table and logs a `status_change` event to the Task 13 timeline. A dedicated
"clear alert" endpoint would have meant either re-implementing that same rule a second time or
finding a reason to bypass it — reusing `PATCH /orders/:id/status` means an alerting order mid-prep
correctly can't be cleared from this screen any more than from the order page itself, with zero new
authorization logic to get wrong.

---

59. Added a second "critical" severity tier instead of leaving every alert looking the same

Sorting oldest-first (already in place) tells you which alert to look at next, but in a long list
nothing distinguished "3 minutes past the threshold" from "3 hours past it" at a glance. A
`CRITICAL_ORDER_MINUTES` env var (default 30, independent of `SLOW_ORDER_MINUTES` rather than a
multiplier of it, so it can be tuned on its own) escalates the visual treatment once an order is far
enough overdue, the same warning-then-critical pattern most monitoring tools use.

---

60. Track who acknowledged an alert, not just when

The original design recorded `alertAcknowledgedAt` but not who — meaning two different people
silencing the same repeat alert would look identical to a manager glancing at it. Added
`alertAcknowledgedById` alongside it. This stays a plain field on `Order`, not a Task 13 `OrderEvent`
— decision #53's reasoning still holds, this is enriching the same non-timeline mechanism, not
reversing the call to keep acknowledgement out of the immutable audit trail.

---

61. A reappeared alert is flagged as a "repeat" using the same acknowledgement fields, not new state

Once `alertAcknowledgedAt` is set, it's never cleared — it just becomes old enough that the order
starts alerting again. That means an alerting order with a non-null `alertAcknowledgedBy` is, for
free, one that already got looked at once and is still stuck: worth flagging differently from a
fresh alert nobody has seen yet, without adding another column to track "is this a repeat."

---

62. The alert thresholds are returned in the `GET /api/alerts` response body

The alerts page shows copy like "open over 15 minutes" — hard-coding that number in the frontend
would silently go stale the moment `SLOW_ORDER_MINUTES` changes in `.env`. Sending
`{ slowOrderMinutes, alertReappearMinutes, criticalOrderMinutes }` alongside the alert list itself
means the UI's explanation of its own behavior can never drift from what the server is actually
enforcing.

---

63. Auto-clearing a stuck order cancels it — it never gets deleted

Asked for literally, but a hard delete would cascade-destroy the order's entire Task 13 audit
timeline along with it, which defeats the whole point of having an immutable history. Cancelling
does everything the actual goal needs (table free again, available for a new order) while leaving a
real record behind of what happened and why. Same reasoning, same mechanism, as decision #58's
manual "Clear table" action — this is just the automatic version of it.

---

64. Auto-clear only ever applies to placed/accepted orders, never preparing

The existing cancellation rule (decision #12, back in Task 3) already blocks cancelling once the
kitchen has started, because the food is already being made — auto-cancelling a preparing order
wouldn't just break that rule, it would actively throw away real food with nobody having decided to.
A preparing order stuck past every other threshold keeps alerting at the critical tier indefinitely;
someone has to actually look at it.

---

65. `OrderEvent.actorId` became optional so the auto-clear sweep can log its own actions

The sweep isn't a person, so it has nobody to attribute a status-change event to. Rather than invent
a fake "System" user account just to satisfy a NOT NULL constraint, `actorId`/`actor` became nullable
— a null actor now means "the system did this," and the timeline renders it as "Automatically
cancelled" instead of a name. The hard rule from Task 13 (never `.update`/`.delete` an `OrderEvent`
row) is unaffected; this only loosens who can be the actor on a `.create`.

---

66. A background `setInterval` sweep, not a real job queue

This app has no worker/queue infrastructure (no Redis, no Bull/Agenda), and adding one just for a
once-a-minute check over a handful of rows would be a lot of new infrastructure for very little
actual load. A plain `setInterval` started once at boot, checking every 60 seconds, is enough for
how rarely an order is ever actually abandoned this long — if this app ever ran across multiple
server instances, this would need to move to a proper single-runner job instead, but that's not
today's problem.

---

67. Alert durations render in whichever unit actually reads naturally, not raw minutes

An order open for 2814 minutes was rendering as "2814m," which nobody reads at a glance as "almost
two days." `formatMinutes()` (client/src/lib/format.js) picks minutes, hours-and-minutes, or
days-and-hours depending on magnitude — the same kind of judgment call `formatCurrency` already makes
for money, just applied to duration.

---

68. A full audit of the project found real gaps, and most of them were deliberately left unfixed

Asked to evaluate everything built against industry standards before adding more features. Found:
no rate limiting on login, no schema-validation library (routes validate by hand), no request
logging/observability, no frontend error boundary, and the alert sweep being a single-process
`setInterval` that would double-process orders behind multiple server instances (already known, see
decision #66). None of these block anything asked for so far, and fixing all of them wasn't asked
for noted here so the gap is a documented, deliberate choice, not a silent blind spot. One finding
does matter for the very next task: the auth cookie is `SameSite=Lax`, which needs client and API on
the same registrable domain (subdomains are fine; genuinely different domains, e.g. two different
hosting providers, would silently break login) — worth knowing before deployment.

---

69. A "deleted" staff member is deactivated, never actually deleted checked, not assumed

Before proposing anything, checked whether a real delete was even possible: `Order.primaryWaiterId`
and `OrderCollaborator.waiterId` are required foreign keys to `User` with no cascade rule, so
Postgres itself rejects deleting anyone who has ever taken or collaborated on an order which is
effectively every waiter who's done any real work. `isActive` follows the exact soft-delete pattern
Tables and MenuItems already use, for the same reason: a deactivated account keeps its full order
history intact and queryable, and can be reactivated if the removal was a mistake.

---

70. A deactivated account loses access on its very next request, not just its next login attempt

Reuses decision #29's exact mechanism (`requireAuth` re-reading the user from the database on every
request) with one more condition added `isActive` is checked the same way `role` already is. A
waiter deactivated mid-shift can't keep using an already-open session for up to 7 days just because
their token hasn't expired yet.

---

71. Login rejects a deactivated account only after the password already matched

Checked in that order deliberately: a wrong password always returns the same generic "Invalid email
or password" regardless of whether the account is active, so a guess can't be used to find out
whether a given email belongs to a deactivated account. Only once the password is confirmed correct
does the deactivated check run, with a clearer message at that point the person already knows the
account is theirs, so there's nothing left to protect by staying vague.

---

72. Can't deactivate the last manager, can't deactivate yourself

Two guards added on top of the existing `canManage` authority check. The last-manager one mirrors
`updateRole`'s identical existing guard against demoting the last manager either way the roster
would be left with nobody who can manage it. The self-deactivation one is new: nothing else in the
app stops someone from acting on their own account this way, and an admin locking themselves out by
accident isn't a case worth allowing just for consistency's sake.

---

73. Auto-clear now skips any order that's ever been acknowledged, not just currently-alerting ones

The original Task 14 sweep only checked `alertAcknowledgedAt` for the reappear-timing calculation,
not as an exemption from clearing at all. Raised as a real concern: a customer could be physically
waiting while their order gets auto-cancelled even though a waiter already knows about the delay and
is handling it. Fixed by adding `alertAcknowledgedAt: null` to the sweep's own `where` clause — once
a human takes responsibility for an order, the system stops overriding that judgment with a timer.
The honest trade-off (a single acknowledgment with no follow-through means an order never
auto-clears) is accepted rather than solved with more logic, because the critical severity tier and
the "repeat alert" tag (decision #61) already keep a stuck-but-acknowledged order visible to a
manager, who can still clear it manually at any time.

---

74. Toast notifications are polled, not pushed — `react-toastify` for display, a `Notification`
    table for knowing when

Same reasoning as decisions #56/#66: this app has no websocket/SSE channel anywhere, and one more
feature isn't reason enough to add one. A `Notification` row is written (in the same transaction as
the cancellation) whenever the auto-clear sweep cancels an order; the recipient's browser polls
`GET /api/notifications/unread` on the same 30-second rhythm as the alerts badge, shows each new one
as a toast, and marks it read immediately so it can't fire twice. The honest limit: a toast can land
up to 30 seconds after the actual cancellation, the same trade-off already accepted everywhere else
"live" in this app.

---

75. A notification's `read` endpoint scopes the update to the caller's own id, not just checked after loading

`markNotificationRead` runs `prisma.notification.updateMany({ where: { id, userId: req.user.id, ... } })`
instead of loading the row first and checking ownership after — a notification belonging to someone
else simply doesn't match the query and comes back as a 404, the same result a real "not found" would
give, without a separate ownership check that could be gotten wrong.

---

76. Order deletion now soft-deletes and is blocked once preparing has started

A pre-deployment review found `DELETE /api/orders/:id` had no status check at all (any waiter could
delete an order that had already been served) and did a real `prisma.order.delete()`, which cascades
onto `OrderLine`/`OrderCollaborator`/`OrderEvent` — silently destroying the very audit trail Task 13
exists to make immutable. Live-reproduced: an order walked through several real status changes, a
voided line, and a collaborator add was deleted by its primary waiter, and its timeline came back 404
afterward. Two fixes, both required together:

- The route now rejects with a 400 unless the order is still `placed` or `accepted` — the exact same
  boundary as cancelling (decision #12) — instead of allowing deletion at any status.
- "Deleting" no longer calls `prisma.order.delete()` at all. It sets `deletedAt`/`deletedById` on the
  order (the same soft-delete pattern already used for `isArchived`/`isActive`) and logs a new
  `order_deleted` event, so the order and every line/collaborator/event row underneath it stay in the
  database untouched. `GET /orders/:id` and `GET /orders/:id/timeline` deliberately keep working for a
  deleted order — that's the whole point — while every other mutating route on that order (status,
  lines, void, collaborators, notes, acknowledge, archive, delete-again) now rejects with 404, and
  every *listing* query (the order list, `/mine`, CSV export, the dashboard, alerts, table occupancy)
  excludes it via `deletedAt: null`. A new `GET /api/orders/deleted` (same visibility rule as every
  other order list) is where that preserved history stays reachable from the UI.

This can only be undone by touching the database directly, matching what was actually asked for: a
waiter can no longer make an order's history disappear from the website, ever, at any status.

---

77. `migrate:deploy` now runs `prisma generate` first, every time

First real Render deploy failed at boot with `ERR_MODULE_NOT_FOUND` on
`generated/prisma/client.ts` — `postinstall` had generated the client fine during the build step,
but it didn't survive into whatever actually ran `npm start` (the generated client lives outside
`node_modules`, at a custom `output` path, so it isn't guaranteed to be treated the same as a
normal dependency by a platform's build/deploy packaging). Since `prisma generate` only reads the
schema file and needs no database connection, it's cheap to run again immediately before start:
`"migrate:deploy": "prisma generate && prisma migrate deploy"`. This means the existing Render
Start Command (`npm run migrate:deploy && npm start`) self-heals with just a redeploy — no dashboard
reconfiguration needed.

---

78. Client → server calls go through Vercel's rewrite proxy, not a direct cross-origin call

The first production deploy had the client call the Render URL directly (`VITE_API_BASE_URL` set to
an absolute `https://...onrender.com/api`), with `CLIENT_ORIGIN` and `SameSite=None; Secure`
(decision #76's sibling auth.controller.js fix) making that work in a normal browser window. It
still broke immediately in Incognito: login "succeeded" (the response body carries the user, so the
UI renders as logged in) and then every following request came back 401. Root cause: a cookie set
by a genuinely cross-site response is a third-party cookie no matter what `SameSite`/`Secure` says,
and Incognito blocks those outright — the cookie from login was never actually stored.

Fixed by removing the cross-site call entirely instead of trying to work around browser third-party-
cookie policy: `client/vercel.json` now rewrites `/api/(.*)` to the deployed Render URL, so the
browser only ever talks to the Vercel domain — the `Set-Cookie` it gets back looks like an ordinary
first-party cookie for whatever host it thinks it's talking to. `VITE_API_BASE_URL` goes back to
being unset (the client's `/api` default), and stays documented as an opt-in escape hatch for a host
without rewrite/proxy support, with the third-party-cookie tradeoff spelled out for whoever reaches
for it next.

Also made `CLIENT_ORIGIN` (`app.js`) trim a trailing slash before being handed to the `cors`
package — found because a copy-pasted Render env var value with a trailing slash produced an
`Access-Control-Allow-Origin` that didn't byte-for-byte match the browser's `Origin` header, which
`cors` treats as a hard mismatch rather than a warning.

**Later reversed/superseded**: the plain `rewrites` entry only reliably proxies GET/HEAD to an
external absolute URL — `POST /api/auth/login` came back as a `405` from Vercel's own edge,
never reaching Render at all. See decision #79, which replaces it with a real serverless function
that has no such method restriction.

---

79. The Vercel → Render proxy is a real serverless function, not a `rewrites` entry

Decision #78's fix (route `/api/*` through the Vercel domain instead of calling Render directly)
was the right call, but the mechanism was wrong: `vercel.json`'s `rewrites` to an external absolute
URL turned out to only reliably forward GET/HEAD — every POST (starting with login itself) came
back `405 Method Not Allowed` straight from Vercel's edge, a response so generic it gave no
indication the request never even reached the actual server.

Replaced with `client/api/[...path].js`, a real Vercel Serverless Function that hand-rolls the
proxy: reads the incoming request's raw body (bodyParser disabled, to forward exact bytes rather
than a re-serialized copy), forwards every header except the hop-by-hop ones, makes the request to
Render with `fetch` using whatever method was actually used, and relays the response back —
including headers, using `Headers.getSetCookie()` specifically for `Set-Cookie` (a response can
carry more than one, and the standard `Headers` API's own accessors incorrectly comma-join multiple
values into one invalid header otherwise, which would have silently broken login again for a
completely different reason). `vercel.json` now only keeps the client-side-routing SPA fallback
rewrite — the `/api/*` path is handled entirely by the function, which Vercel's filesystem routing
matches before it ever considers the `rewrites` array.

**Later reversed/superseded**: that last claim about routing precedence was wrong for a plain
catch-all pattern. See decision #80 — the SPA fallback rewrite still needed to explicitly exclude
`/api/*`, or it swallows those requests too.

---

80. The SPA fallback rewrite explicitly excludes `/api/*`

Right after decision #79's fix, login still came back `405` — this time on our own domain, from
our own proxy function, which made no sense until the actual cause turned up: `vercel.json`'s SPA
fallback, `{"source": "/(.*)", "destination": "/index.html"}`, matches literally every path,
including `/api/*`, not just client-side routes. It was rewriting `POST /api/auth/login` to serve
the static `index.html` file instead — and a static file only accepts GET/HEAD, so Vercel correctly
(from a static server's point of view) rejected the POST with `405`. The one GET request tested
alongside it (`/api/auth/me`) came back looking fine (`304 Not Modified`), which was itself
misleading: it was almost certainly being served a cached `index.html`, not real JSON, just quiet
about it because GET is a method a static file server accepts.

Fixed with a negative-lookahead source pattern — `"/((?!api/).*)"` — so the SPA fallback only
matches paths that don't start with `api/`, leaving those alone for the function to actually handle.
The underlying lesson, restated from decision #79's now-corrected claim: a project's own filesystem
functions don't automatically win against every possible `rewrites` pattern — a sufficiently greedy
rewrite (like a bare catch-all SPA fallback) can still intercept a path a function would otherwise
have served, and needs to explicitly carve out an exception for it.

---

