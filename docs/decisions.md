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



