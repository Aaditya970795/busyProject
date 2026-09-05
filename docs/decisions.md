# Decisions

The real choices made along the way, where more than one option was reasonable and one had to be
picked not every line of code written. Organized by which of the ten goals each decision belongs
to. Numbers keep going up; nothing gets renumbered later, only marked as later reversed.

---

## Accounts and roles

### Decision 1 — How a manager account ever gets created

**Chose:** Nothing. **Rejected:** Letting the client pick its own `role` at signup.

The register endpoint originally took `role` straight from the request body, so anyone could sign up
as a manager. The immediate patch was to strip `role` from the request and force every signup to
waiter, closing the hole with a one-line change.

**Later reversed/superseded:** That patch only lasted until the very next piece of work, once it was
clear that fixing one field didn't answer how a manager account should ever legitimately get
created. See Decision 3.

### Decision 2 — `requireAuth` re-reads the role from the database on every request, not from the token

**Chose:** Look the user up fresh on every request. **Rejected:** Trusting the role baked into the
JWT.

The token used to carry `role` as a claim and trust it as-is. That meant a role change wouldn't take
effect until the old token expired (up to 7 days), and a deleted user's token kept working on every
route except the "who am I" one, which did its own check. Found while verifying the fix in Decision
1. Fixed with one database lookup per request instead of trusting the token's payload.

### Decision 3 — Added a real `admin` role instead of further tightening the manager/waiter check

**Chose:** A third role, `admin`, ranked above manager. **Rejected:** Hard-coding "only a manager can
promote someone" (circular the first manager would still need to come from somewhere).

Once self-registration as a manager had to close for good, something had to gate who becomes a
manager. Admin manages managers and waiters; manager manages only waiters.

### Decision 4 — A manager creates only waiter accounts; only admin creates managers or changes anyone's role

**Chose:** Split authority by rank, reused everywhere as one shared rule. **Rejected:** Letting a
manager promote a waiter to manager themselves, which the app previously allowed.

### Decision 5 — No account, including admin's own, is ever created or promoted to admin through the API

**Chose:** Zero HTTP surface at the top of the hierarchy the one admin account got its role set
once, directly against the database, by a script written for that purpose and deleted right after.
**Rejected:** Any API path to becoming admin, even an admin-gated one.

**Why:** Nothing to find, guess, or race at the top of the hierarchy. The tradeoff: recovering a lost
admin account needs the same direct database access, not an API call.

### Decision 6 — Password reset follows the exact same authority rule as account creation

**Chose:** Reuse the same rule whoever could create an account can reset its password. **Rejected:**
A separate, second permission check.

**Why:** There's no email infrastructure to send a reset link, so this is the app's entire answer to
"forgot password." A manager resets a waiter's password, an admin resets a manager's or a waiter's,
nobody resets an admin's this way.

### Decision 7 — A "deleted" staff member is deactivated, never actually deleted

**Chose:** `User.isActive`, same soft-delete pattern already used for menu items and tables.
**Rejected:** A real row delete.

**Why:** Checked the schema before proposing anything: `primaryWaiterId` and `waiterId` are required
foreign keys to `User` with no cascade rule, so Postgres itself rejects deleting anyone who's ever
taken or collaborated on an order effectively every waiter who's done real work. A deactivated
account keeps its full order history intact and can be reactivated if the removal was a mistake.

### Decision 8 — Login rejects a deactivated account only after the password already matched

**Chose:** Check the password first, then the active flag. **Rejected:** Checking active status
before or alongside the password check.

**Why:** A wrong password always returns the same generic "Invalid email or password" regardless of
whether the account is active, so a guess can't be used to find out whether a given email belongs to
a deactivated account.

---

## Orders

### Decision 9 — Orders can be deleted, not just archived

**Chose:** Let a waiter fully delete an order started by mistake, on top of the existing archive
option, with a confirmation step. **Rejected:** Archive-only, no real delete at all.

**Later reversed/superseded:** A later review found the delete route never actually enforced
"started by mistake" it could be called at any status, including after the order was served, and
did a real database delete that destroyed the order's audit trail. See the audit-timeline section
below for the fix.

### Decision 10 — The Table list has no foreign key relationship to Order

**Chose:** Keep `Order.tableNumber` a plain integer, work out occupancy by comparing numbers in code.
**Rejected:** A real foreign-key relation between `Table` and `Order`.

**Why:** A real relation would have meant backfilling every existing order with a matching table row
before the migration could run. Keeping them separate meant the whole table-management feature could
be added without touching the `Order` table's shape at all.

### Decision 11 — An order can't be created without at least one item

**Chose:** Require `menu_item_id` and `quantity` up front, creating the order and its first line
together in one atomic write. **Rejected:** Allowing a bare `{ table_number }` request to create an
empty order.

**Why:** Found by testing, not by inspection a single click could leave an empty order sitting in
the system with no items on it at all.

### Decision 12 — Closed the table-double-booking race with a database-level transaction

**Chose:** Wrap the occupancy check and the order creation in one transaction at Postgres's
Serializable isolation level. **Rejected:** Relying on the application to catch the race after the
fact.

**Why:** The occupancy check and the create used to be two separate, unlocked statements two
requests for the same table arriving close together could both pass the check before either
committed. Proved with real concurrent requests fired at the same table, not just reasoning about it.

---

## Order lines

### Decision 13 — Kept the price check for menu items in the code, not the database

**Chose:** Reject a negative price in the controller. **Rejected:** A database constraint refusing a
negative price.

**Why:** A database-level check would have meant hand-editing the migration file every time; the code
was already where every similar rule lived.

### Decision 14 — Adding the same item twice combines it into one line instead of two

**Chose:** Bump the quantity on the existing line if the price hasn't changed since it was first
added. **Rejected:** Always creating a new line.

**Why:** If the price did change in between, it stays as two separate lines on purpose, so the order
still shows exactly what was charged at each point in time.

---

## The lifecycle

### Decision 15 — Order status can only move forward one step at a time

**Chose:** placed → accepted → preparing → ready → served, one step, no skipping or reversing.
**Rejected:** Allowing a status to jump ahead (e.g. straight from placed to ready).

### Decision 16 — Cancelling only works while placed or accepted

**Chose:** Block cancellation once an order reaches preparing. **Rejected:** Allowing cancellation at
any pre-served status.

**Why:** Once the kitchen has started, the food is already being made.

### Decision 17 — Blocked adding new items to an order that's already served or cancelled

**Chose:** Only allow adding items while the order is still open. **Rejected:** Leaving it possible
to add items to a finished order.

**Why:** Noticed while testing adding something to an order that's already dead didn't make sense.

---

## Collaborators

### Decision 18 — Collaborators can only be added by the primary waiter or a manager

**Chose:** Restrict who can attach a collaborator to those two roles. **Rejected:** Letting any
collaborator, or any waiter at all, add someone.

**Why:** The brief didn't specify who's allowed to add a collaborator. Letting anyone attach
themselves or anyone else to someone else's order felt like the wrong default.

---

## Finding orders

### Decision 19 — `GET /api/orders` enforces the same visibility as `GET /orders/mine`

**Chose:** Merge the primary-waiter-or-collaborator rule into the main list's own `where` clause.
**Rejected:** Leaving the main list open to everyone and only restricting the "my orders" shortcut.

**Why:** A waiter combining filters (say, searching a specific table) should never be able to see an
order they weren't already allowed to see.

### Decision 20 — Table-number search uses one raw SQL query instead of a numeric-range trick

**Chose:** A single parameterized raw query casting the column to text for a real substring match.
**Rejected:** Computing numeric ranges to approximate a prefix match.

**Why:** `tableNumber` is an integer and Prisma's "contains" filter only works on text columns. The
numeric-range alternative still couldn't do a genuine substring match (searching "1" wouldn't find
table 21).

### Decision 21 — Added the four indexes a later audit found missing

**Chose:** Index `Order.primaryWaiterId`, `Order.tableNumber`, `OrderLine.orderId`,
`OrderCollaborator.waiterId`. **Rejected:** Leaving them unindexed since nothing was functionally
wrong.

**Why:** These are exactly the foreign-key columns filtered on in the app's most common queries.
Prisma doesn't add these automatically an easy thing to overlook until a query plan gets slow.

### Decision 22 — `GET /api/orders/:id` now requires the same access check as every mutating endpoint

**Chose:** Apply `canActOnOrder` to reading a single order too. **Rejected:** Leaving it open, as it
had been left deliberately at the time collaborators were added.

**Why:** Closed an inconsistency rather than leave it as a known gap every other order-reading
endpoint already had this rule.

---

## Bulk actions and CSV export

### Decision 23 — Bulk menu update processes each id independently, never inside one transaction

**Chose:** A plain loop with its own try/catch per id. **Rejected:** One `prisma.$transaction`
covering the whole batch.

**Why:** A single transaction would roll every item back the moment one of them failed. The actual
requirement was the opposite partial success, with a per-item report of what happened.

### Decision 24 — Neutralize CSV cells that start with a formula-trigger character

**Chose:** Prefix a cell starting with `=`, `+`, `-`, `@`, or a tab with a literal `'`. **Rejected:**
Leaving cell values untouched.

**Why:** Found via a security pass on the export feature, proven with an actual `=HYPERLINK(...)`
payload in a waiter's own display name without this, a low-privilege user's name or a void reason
could execute as a formula when a manager opens the exported file.

---

## The dashboard

### Decision 25 — The dashboard summary endpoint is manager-and-above only; a waiter gets a different view

**Chose:** Build the waiter-facing view entirely from the existing `GET /orders/mine` data, with no
new endpoint. **Rejected:** Sending a waiter a cut-down version of the manager payload.

**Why:** Open orders, revenue, and a per-waiter leaderboard all read as a management view, not
something a waiter needs for their own job.

### Decision 26 — "Served today" and the 14-day trend originally approximated from `updatedAt`

**Chose:** Treat "status is currently served and was last touched today" as good enough, for now.
**Rejected:** Building a real event log just for this.

**Why:** There was no table recording when an order changed to each status yet. Documented as a known,
rare-miscount limitation rather than silently accepted.

**Later reversed/superseded:** Once the audit-timeline event log existed, both figures were switched
to read the order's real status-changed-to-served event instead — see Decision 29.

---

## The audit timeline

### Decision 27 — Every audit-trail write happens inside the same transaction as the change it records

**Chose:** A status update, a line add, and a line void each write their `OrderEvent` row in the same
transaction as the mutation. **Rejected:** Writing the event as a separate follow-up statement.

**Why:** The two either both commit or both roll back — no window where the order changed but the
event log doesn't know it, or vice versa.

### Decision 28 — `OrderEvent` rows can only ever be created — no code path updates or deletes one

**Chose:** Enforce this by convention through one shared helper (`logEvent`), never called for
update/delete. **Rejected:** A database trigger, or allowing edits for a manager specifically.

**Why:** An audit trail that can be edited or removed after the fact isn't an audit trail — the whole
point is that it's the one thing in the app nobody can quietly rewrite.

### Decision 29 — Dashboard's `servedToday` and the trend chart now read the order's real served-at event

**Chose:** Switch both figures to the audit-timeline's own `status_change` event where `newValue`
is `served`. **Rejected:** Keeping the old `updatedAt`-based approximation now that a real event log
existed.

**Why:** `served` is a terminal status an order can only ever get exactly one such event — so its
timestamp is the actual moment it happened, not a guess, and it's no longer thrown off by an order
being archived and unarchived later.

### Decision 30 — Acknowledging a slow-order alert is not logged to the audit timeline

**Chose:** Leave it out, recorded only as a plain timestamp/who field on the order itself.
**Rejected:** Extending the event log to cover it.

**Why:** The timeline records what happened to the order itself its status, its lines, its notes.
Acknowledging an alert doesn't touch any of that; it's a record of who's paying attention, not a
change to the order's food, bill, or lifecycle.

### Decision 31 — Order deletion now soft-deletes and is blocked once preparing has started

**Chose:** Restrict deletion to `placed`/`accepted` only, and replace the real database delete with a
`deletedAt`/`deletedById` flag the order and its full history stay in the database, hidden from
normal listings but still reachable directly. **Rejected:** Leaving deletion as an unrestricted real
delete (see Decision 9).

**Why:** The real delete had no status check at all and cascaded away the order's entire audit trail
 exactly what the audit-timeline goal exists to prevent. This fix directly answers that: a waiter
can no longer make an order's history disappear, ever, at any status, without touching the database
directly.

---

## Slow-order alerts

### Decision 32 — Auto-clearing a stuck order cancels it — it never gets deleted

**Chose:** Cancel a placed/accepted order left open past the auto-clear threshold. **Rejected:** A
real delete, even though "auto-clear" was asked for in terms that could have meant either.

**Why:** A hard delete would cascade-destroy the order's entire audit timeline, defeating the point
of having one. Cancelling frees the table just as completely while leaving a real record of what
happened.

### Decision 33 — Auto-clear only ever applies to placed/accepted orders, never preparing

**Chose:** Exempt any order already being prepared. **Rejected:** Auto-cancelling any stuck order
regardless of status.

**Why:** The kitchen has already started on a preparing order auto-cancelling it would waste real
food, not just break a rule. A preparing order stuck this long keeps alerting at the critical tier
until a person deals with it.

### Decision 34 — Auto-clear skips any order that's ever been acknowledged, not just currently-alerting ones

**Chose:** Add `alertAcknowledgedAt: null` to the sweep's own query, exempting acknowledged orders
entirely. **Rejected:** Only using the acknowledgement timestamp for reappear-timing, as it
originally worked.

**Why:** A customer could be physically waiting while their order gets auto-cancelled even though a
waiter already knows about the delay. Once a human takes responsibility for an order, the system
shouldn't override that judgment with a timer. Accepted trade-off: a single acknowledgment with no
follow-through means an order can sit open forever the critical severity tier and the "repeat
alert" tag already keep it visible to a manager, who can still clear it manually.

### Decision 35 — Toast notifications are polled, not pushed

**Chose:** A `Notification` table, written in the same transaction as an auto-cancellation, polled by
the browser every 30 seconds and shown with `react-toastify`. **Rejected:** A websocket/SSE channel.

**Why:** This app has no push infrastructure anywhere, and one more feature wasn't reason enough to
add one. Accepted limit: a toast can land up to 30 seconds after the actual cancellation.

---

## Deployment

### Decision 36 — `migrate:deploy` runs `prisma generate` first, every time

**Chose:** `"migrate:deploy": "prisma generate && prisma migrate deploy"`. **Rejected:** Relying on
the build step's own `prisma generate` (via `postinstall`) to have already produced a usable client.

**Why:** The first real deploy failed at boot because the generated Prisma client which lives
outside `node_modules`, at a custom output path didn't survive from the build step into whatever
actually ran the server. `prisma generate` needs no database connection, so it's cheap to run again
immediately before start; this also means the existing start command self-heals with just a
redeploy, no dashboard reconfiguration needed.

### Decision 37 — Client-to-server calls go through a same-origin proxy, not a direct cross-origin call

**Chose (first attempt):** Call the Render URL directly from the client, with `SameSite=None; Secure`
on the auth cookie. That worked in a normal browser window but broke immediately in Incognito: a
cookie set by a genuinely cross-site response is a third-party cookie no matter what `SameSite`/
`Secure` says, and Incognito blocks those outright login looked like it succeeded, then every
following request came back 401, because the cookie was never actually stored.

**Later reversed/superseded three more iterations before this actually worked:**

- **Attempt 2:** A plain `vercel.json` rewrite straight to the external Render URL. Rejected once
  live: it only reliably forwards GET/HEAD, so every POST (starting with login) came back a `405`
  from Vercel's own edge, never reaching Render at all.
- **Attempt 3:** A dynamic catch-all Serverless Function file (`api/[...path].js`). Rejected once
  live: it never routed correctly on this project at all, for reasons never fully pinned down
  confirmed by deploying a plain, non-dynamic function in its place, which worked immediately on the
  exact same settings.
- **Attempt 4, and also blocked once by an unrelated bug:** the SPA fallback rewrite's own catch-all
  pattern (`/(.*)`) was matching `/api/*` too, rewriting API calls to the static `index.html` file
  fixed by excluding `/api/*` from that pattern explicitly.
- **What actually shipped:** one plain function (`api/proxy.js`), reached through an explicit
  internal rewrite (`/api/(.*)` → `/api/proxy?path=$1`) rather than Vercel's dynamic file-routing
  convention. Verified end-to-end against the live production URL login, session persistence, role
  enforcement, a real order creation, and logout in both a normal browser and Incognito.

**Why the final shape works where the others didn't:** the browser only ever talks to the Vercel
domain now, for every request, so the login cookie is set by a same-origin response and no
third-party-cookie policy applies to it at all regardless of `SameSite`/`Secure`, which stay set
the same way as a defensive default.
