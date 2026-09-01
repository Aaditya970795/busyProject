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


