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


