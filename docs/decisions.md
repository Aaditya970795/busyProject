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
archived and unarchived today would be miscounted a rare, acceptable gap for now, documented in
the code as a known limitation rather than silently accepted.

---

44. The dashboard refreshes itself every 30 seconds instead of needing a manual reload

A dashboard is read-mostly and only useful if the numbers on it are close to current. TanStack
Query's `refetchInterval` handles this without hand-rolling a polling loop, and 30 seconds felt
frequent enough to feel live without hammering the aggregate query on every render.

---

45. Mobile nav collapses behind a hamburger button below the `md` (768px) breakpoint, instead of a
    bottom tab bar or an always-visible condensed nav

Matches the one existing nav bar's structure most closely brand, links, user info, and logout all
already lived in one row, so hiding that row behind a toggle below `md` and showing a stacked
equivalent in a drawer needed no new navigation model, just a second rendering of the same links.

---

46. Tables scroll horizontally on narrow screens instead of collapsing into stacked cards

A dedicated mobile card layout for every table (Menu, Orders, Order Detail, Team) would have meant a
second, parallel markup structure per table to keep in sync with the desktop one forever after.
Wrapping the existing `<table>` in a scrollable container with a `min-width` keeps exactly one markup
structure per page — a phone user scrolls sideways to see every column, which is a normal, understood
pattern, rather than the app inventing a different information layout just for small screens.



