# Database Schema

This is what's actually in `server/prisma/schema.prisma`. If you want to see the raw SQL that got
run against Postgres, check `server/prisma/migrations/20260831094601_init/migration.sql`.

## The User table

Right now there's just one table.

| Field          | Type       | What it's for                                                    |
|----------------|------------|--------------------------------------------------------------------|
| `id`           | text (uuid) | the primary key Prisma generates this uuid on the client side, it's not a Postgres auto-increment number. |
| `name`         | text        | just their display name, no length limit set.                    |
| `email`        | text        | has to be unique Postgres itself enforces this with a unique index, not just app code. |
| `passwordHash` | text        | the bcrypt-hashed password. We never store or log the real password anywhere. |
| `role`         | enum        | either `manager` or `waiter`. *(Update, Task 9: there's a third value now see below.)* |
| `createdAt`    | timestamp   | set automatically when the row is created.                       |

And the role enum itself:

```prisma
enum Role {
  manager
  waiter
}
```

This is a real Postgres enum type, not just a text column with a check so it's genuinely
impossible to put anything other than "manager" or "waiter" in that column, even by accident.

*(Update, Task 9: the enum gained a third value, `admin`, ranked above manager see
`server/src/lib/roles.js` and `docs/architecture.md`'s Task 9 section for what that actually changes.
`admin` is a real value the database will happily store, but the application layer never assigns it
through any endpoint the sole admin account got its role set directly, by a one-time script run
against the database once, never through the API.)*

## The Menu Item table (added in Task 2)

Managers can add things to the menu now. Each menu item has:

- a name
- a price (stored as an exact number, not a rough decimal, so money never gets rounded wrong)
- whether it's currently available to order or not
- whether it's been archived (basically hidden, but not deleted I kept it in the database so old
  orders that used it still make sense)
- when it was created and when it was last changed

Nothing gets deleted for real here. Archiving just hides an item from the everyday menu list, but a
manager can still look at archived items and bring one back if they change their mind.

## The Order table and Order Line table (added in Task 2)

An order belongs to one table in the restaurant and one waiter (whoever created it). It also has a
status — more on that below, since Task 3 built out the whole rules around that.

Each order can have many order lines, and each line is basically "this many of this menu item, with
this note." A line remembers the price the item had at the exact moment it was added to the order
not whatever the menu item costs right now. That way, if a manager changes a price later, old orders
still show what the customer actually agreed to pay at the time.

A line can also be voided (basically cancelled) with a reason, if a waiter added the wrong thing by
mistake or a customer changed their mind. Voided lines never get removed from the database either
they just get marked as voided so there's a record of what happened, and they stop counting toward
the order's total.

## Relations between tables

None yet there's only the one table so far. This will obviously grow once menu items and orders
show up.

That was true back when there was only the User table. Since Task 2, a few real connections exist
now:

- One waiter can create many orders.
- One order can have many order lines.
- One menu item can show up on many order lines (since lots of orders can include the same dish).

Also worth knowing: if an order ever gets deleted, all of its lines get deleted along with it
automatically I don't have to clean those up by hand, the database takes care of it.

## The OrderCollaborator table (added in Task 4)

Lets more than one waiter act on the same order. Each row just says "this waiter is attached to this
order":

- `orderId` and `waiterId` together form the primary key a waiter can only be attached to the same
  order once, and the database itself won't allow a duplicate row, no app-side check needed for that
  part.
- `addedAt` when they were added.

If the order gets deleted, its collaborator rows get deleted along with it automatically (same
cascading behavior as order lines).

## The Table table (added in Task 5)

A simple standalone list a manager maintains:

- `number` has to be unique, enforced by the database with a unique index, same pattern as email
  on the User table.
- `isArchived`same "soft delete" idea as menu items. Removing a table just hides it, it doesn't
  delete the row.
- `createdAt`.

This table doesn't have any foreign key pointing at it, and nothing points a foreign key back at
`Order` either `Order.tableNumber` is still just a plain integer, unrelated at the database level
to this new table. Whether a table is "occupied" gets worked out by comparing `Table.number` against
the `tableNumber` on any order that's still open that comparison happens in the code, not as a
database relationship.

## The OrderEvent table (added in Task 13)

The audit trail. One row per thing that happened to an order — a status change, a line added, a
line voided, a note, or (see below) the order being deleted:

- `eventType` a real Postgres enum (`status_change`, `line_added`, `line_voided`, `note`,
  `order_deleted`), same "the database physically can't store garbage here" reasoning as `Role`.
- `oldValue`/`newValue` free-text, meaning depends on `eventType` (e.g. the old/new status for a
  `status_change`, or the item description for a `line_added`).
- `note` used for a voided line's reason or a standalone note's text.
- `actorId` who did it nullable, because the one automated actor in this app (the auto-clear sweep,
  Task 14) isn't a person and has nobody to attribute the event to. A null actor renders as
  "Automatically cancelled" in the UI instead of a name.
- `createdAt`.

Every write to this table goes through one helper (`logEvent`), always inside the same transaction
as the change it's recording. Nothing in the app ever calls `.update`/`.delete`/`.deleteMany` on it
— see decision #48. `OrderLine.status` is likewise a real enum now (`LineStatus`: `active`/`void`),
not a boolean, since a voided line still needs to render its `voidReason`.

## Alert-related fields on Order (added in Task 14)

- `alertAcknowledgedAt`/`alertAcknowledgedById` when an alerting order was last acknowledged, and
  by whom. Never cleared once set — an alert "reappearing" just means enough time has passed since
  this timestamp (see `ALERT_REAPPEAR_MINUTES`), not a new column being flipped.

These deliberately live as plain columns on `Order`, not as `OrderEvent` rows — decision #53 covers
why acknowledging an alert isn't part of the Task 13 audit timeline.

## The Notification table (added in Task 15)

A personal inbox row, one per user per thing they need to know about (today, only the auto-clear
sweep cancelling one of their orders):

- `userId`/`orderId` who it's for, and which order it's about (`orderId` optional, so this doesn't
  become order-specific forever).
- `message` the actual text.
- `readAt` nullable; set the moment the recipient's browser polls and shows it as a toast, so it
  can't fire twice.

Polled from `GET /api/notifications/unread`, same trade-off as the alerts badge (decision #56):
there's no websocket/SSE channel in this app, so "live" means "at most 30 seconds stale."

## Soft-delete fields on Order (added in a pre-deployment review)

- `deletedAt`/`deletedById` set by `DELETE /api/orders/:id` instead of an actual row delete — see
  decision #76. The order, its lines, its collaborators, and its `OrderEvent` history all stay in
  the database exactly as they were; every normal query (the order list, `/mine`, CSV export, the
  dashboard, alerts, table occupancy) just adds `deletedAt: null` to keep a deleted order out of
  everyday view. `GET /orders/:id` and `GET /orders/:id/timeline` are the deliberate exception —
  they keep working for a deleted order's id, which is the whole point of not hard-deleting it.

## Indexes added for search and sorting (added in Task 6)

Two indexes went on the Order table once the order list started supporting filtering and sorting by
status and by placed date: `@@index([status])` and `@@index([createdAt])`. Without them, every
filtered or sorted request would need a full table scan to find matches; with a lot of orders sitting
in the table, that's the difference between a search that feels instant and one that doesn't.

## More indexes, found missing during the security audit (added in Task 8)

Four more foreign-key columns turned out to have no index at all, despite being exactly the columns
filtered on in the app's most frequently run queries: `Order.primaryWaiterId` and `Order.tableNumber`,
`OrderLine.orderId`, and `OrderCollaborator.waiterId`. The first two are hit on every order-visibility
check and every table-occupancy check; the third on every single order-detail fetch; the fourth is
the other half of the same visibility check `primaryWaiterId` covers, for orders someone's a
collaborator on rather than primary on. None of this was wrong, exactly Prisma doesn't add these
automatically unless you ask just an easy thing to overlook until a query plan actually gets slow.

## Where do I check things — the app or the database?

- **Role has to be valid**: checked in both places on purpose. The database physically can't store
  a bad role because of the enum type. But I also check it in the controller before it even gets
  that far, so a bad request comes back as a clean "role must be manager or waiter" message instead
  of some ugly database error.
- **Email has to be unique**: enforced by the database's unique index. On the app side, I don't
  bother checking "does this email already exist" before creating I just try to create it, and if
  Postgres complains (error code P2002), I catch that and send back a friendly "email already
  registered" message. Checking first and then creating would actually leave a small window where
  two signups could sneak through with the same email at the same time.
- **Password needs to be at least 8 characters**: this one's app-side only, since the database only
  ever sees the hashed version, which doesn't really have a "length" to check.
- **Menu item prices can't be negative**: I check this in the code, not the database. I thought
  about making the database itself refuse a negative price, but that would have meant hand-editing
  the migration file every time, which felt fragile and easy to forget. Checking it in the code
  keeps everything in one place and gives a clear error message instead of a confusing database
  error.
- **Order status can only move forward one step at a time, and only in the right order**: this is
  all checked in the code before anything gets saved. The database will happily store any of the six
  statuses, but it has no idea which order they're supposed to happen in that logic lives in the
  code.
- **Voiding a line always needs a reason**: checked in the code if you don't type a reason, the
  request gets rejected before it ever touches the database.
- **Who's allowed to act on an order (manager, primary waiter, or a collaborator)**: checked in the
  code, through one shared function instead of being copy-pasted into every route. The database has
  no idea collaborators mean anything special; it just stores the rows.
- **A table has to actually exist and not already be occupied before an order can be opened on it**:
  checked in the code, in `POST /api/orders`, every single time not just something the frontend's
  table picker happens to prevent.
- **What a waiter can see in the order list vs. what they filtered for**: checked in the code — the
  visibility rule and any filters the caller passed (status, waiter, date, table search) are merged
  into the exact same `where` clause, so there's no way to filter your way into seeing an order you
  couldn't otherwise see.
- **Table-number text search**: mostly the database's job a small raw SQL query does the actual
  substring match (something a plain `where` clause can't express against a number column), but it's
  written with Prisma's parameterized `$queryRaw`, so user input never gets concatenated into the SQL
  string directly.
- **A table can't be double-booked by two requests arriving at the same instant**: enforced by the
  database, not the code the occupancy check and the order creation run inside one Serializable
  transaction, so Postgres itself refuses to let two overlapping transactions both succeed, rather
  than the application trying to catch a race it can't actually see.
- **Who's allowed to create which kind of account, reset whose password, or change anyone's role**:
  entirely app-side, through one shared `canManage(callerRole, targetRole)` rule the database has
  no idea a manager and a waiter are in a hierarchy, it just stores whatever role value it's given
  (subject to the enum, per above).
- **A logged-in request is acting as the role the database currently says, not whatever role was
  true when they logged in**: checked on every single request now, not just at login — `requireAuth`
  re-reads the user's row before anything else runs, specifically so a role change (or a deleted
  account) takes effect immediately instead of waiting for the existing token to expire.
- **A CSV export cell that starts with a formula-triggering character** (`=`, `+`, `-`, `@`, tab):
  neutralized in the code before it's written out, by prefixing it with a literal `'`  Excel/Sheets
  then render it as text instead of evaluating it. The database stores the original value untouched;
  this is purely an export-time concern.
- **An order can only be deleted while it's still `placed` or `accepted`**: checked in the code,
  the same boundary as cancelling. The database has no idea what "deleted" even means here — it's
  never a real row delete, just `deletedAt`/`deletedById` being set (see decision #76).
