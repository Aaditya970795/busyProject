# Database Schema

What's actually in `server/prisma/schema.prisma`. Raw SQL for the first migration is in
`server/prisma/migrations/20260831094601_init/migration.sql`.

## The tables

### User

| Field | Type | Notes |
|-------|------|-------|
| `id` | text (uuid) | Primary key, generated on the client side, not a Postgres auto-increment number. |
| `name` | text | Display name, no length limit. |
| `email` | text | Unique  enforced by the database with a unique index, not just app code. |
| `passwordHash` | text | bcrypt hash. The real password is never stored or logged anywhere. |
| `role` | enum (`Role`) | `admin`, `manager`, or `waiter`. A real Postgres enum, so the database can't hold anything else, even by accident. No account is ever created or promoted to `admin` through the API  the one admin account had its role set once, directly against the database, by a one-time script that was deleted right after. |
| `isActive` | boolean | Deactivating a staff member sets this to false instead of deleting the row see "database vs. app" below for why a real delete usually isn't even possible. |
| `createdAt` | timestamp | Set automatically on creation. |

### MenuItem

| Field | Type | Notes |
|-------|------|-------|
| `name` | text | |
| `price` | exact decimal | Not a float, so money never rounds wrong. |
| `isAvailable` | boolean | Whether it's currently orderable. |
| `isArchived` | boolean | Soft delete hidden from the everyday menu, still in the database, can be brought back. |
| `createdAt` / `updatedAt` | timestamp | |

### Order

| Field | Type | Notes |
|-------|------|-------|
| `tableNumber` | integer | Plain number, not a foreign key to `Table` see below. |
| `status` | enum (`OrderStatus`) | `placed`, `accepted`, `preparing`, `ready`, `served`, `cancelled`. |
| `primaryWaiterId` | text | The waiter who created it. |
| `isArchived` | boolean | Hides an order from the default active queue without touching its history. |
| `alertAcknowledgedAt` / `alertAcknowledgedById` | timestamp / text, nullable | When a slow-order alert was last acknowledged, and by whom. Never cleared once set an alert "reappearing" just means enough time has passed since this timestamp. |
| `deletedAt` / `deletedById` | timestamp / text, nullable | Set instead of an actual row delete when an order is "deleted." The order, its lines, its collaborators, and its full history all stay in the database every normal listing query just excludes rows where `deletedAt` isn't null. |
| `createdAt` / `updatedAt` | timestamp | |

### OrderLine

| Field | Type | Notes |
|-------|------|-------|
| `orderId` / `menuItemId` | text | |
| `quantity` | integer | |
| `specialInstructions` | text, nullable | |
| `unitPrice` | exact decimal | The menu item's price at the moment this line was added not whatever it costs now. See "denormalized" below. |
| `status` | enum (`LineStatus`) | `active` or `void`. A real enum, not a boolean, since a voided line still needs to show its `voidReason`. |
| `voidReason` | text, nullable | Required whenever a line is voided; never deleted, just marked void so there's a record. |
| `createdAt` | timestamp | |

### OrderCollaborator

A join row: "this waiter is attached to this order." `orderId` + `waiterId` together are the primary
key, so the database itself won't allow the same waiter added twice to the same order no app-side
check needed for that part. Has an `addedAt` timestamp.

### Table

A simple list a manager maintains: `number` (unique, same pattern as `User.email`), `isArchived`
(soft delete, same as `MenuItem`), `createdAt`. No foreign key points at it, and it doesn't point
one back at `Order` either.

### OrderEvent

The audit trail one row per status change, line added, line voided, note, or order deletion.

| Field | Type | Notes |
|-------|------|-------|
| `eventType` | enum (`EventType`) | `status_change`, `line_added`, `line_voided`, `note`, `order_deleted`. |
| `oldValue` / `newValue` | text, nullable | Meaning depends on `eventType` e.g. old/new status, or an item description. |
| `note` | text, nullable | A voided line's reason, or a standalone note's text. |
| `actorId` | text, nullable | Who did it. Nullable because the one automated actor in this app (the auto-clear sweep) isn't a person; a null actor renders as "Automatically cancelled" in the UI. |
| `createdAt` | timestamp | |

Every write to this table goes through one helper (`logEvent`), always inside the same transaction
as the change it's recording. No code path ever calls `.update`/`.delete`/`.deleteMany` on it.

### Notification

One row per user per thing they need to know about today, only the auto-clear sweep cancelling
one of their orders. `userId`, an optional `orderId`, a `message`, and a nullable `readAt` set the
moment the recipient's browser polls it and shows it as a toast, so it can't fire twice.

## One-to-many vs. many-to-many

Everything except one relationship is one-to-many:

- One waiter → many orders (`primaryWaiterId`).
- One order → many order lines.
- One menu item → many order lines (the same dish shows up on lots of orders).
- One order → many events.
- One user → many notifications.

The one many-to-many relationship is waiters and orders, through `OrderCollaborator`: a waiter can
collaborate on any number of orders, and an order can have any number of collaborators. If an order
gets deleted (a real row delete before the soft-delete change below existed, or in earlier stages
of the schema), its lines and collaborator rows are removed automatically by the database, not
cleaned up by hand.

## Database vs. app-enforced constraints, and why

- **Role has to be a valid value** the database, via the `Role` enum; it physically can't store
  anything else. Also checked in the controller before that, so a bad request gets a clean message
  instead of a database error.
- **Email has to be unique** the database's unique index. The app doesn't check first and then
  create; it just tries to create, and catches the database's duplicate-key error to send back a
  friendly message. Checking first would leave a small window where two signups could race each
  other with the same email.
- **Password length (at least 8 characters)** app-side only, since the database only ever sees
  the hash, which has no meaningful "length" to check.
- **Menu item prices can't be negative** app-side. Enforcing it in the database would mean
  hand-editing the migration file every time; the code was already where every similar rule lived.
- **Order status can only move forward one step at a time** app-side. The database will happily
  store any of the six statuses; it has no idea what order they're supposed to happen in.
- **Voiding a line needs a reason** app-side, rejected before it touches the database.
- **Who's allowed to act on an order** (manager, primary waiter, or collaborator) app-side,
  through one shared function. The database has no idea collaborators mean anything special; it
  just stores the rows.
- **A table has to exist and not already be occupied** before an order opens on it checked in the
  code on every request, not just something the picker happens to prevent.
- **A table can't be double-booked by two requests at the same instant** the database. The
  occupancy check and the order creation run inside one transaction at Postgres's Serializable
  isolation level, so Postgres itself detects the overlap and rejects the loser.
- **Who can create which kind of account, reset whose password, or change anyone's role**
  entirely app-side, through one shared rule. The database has no idea a manager and a waiter are in
  a hierarchy.
- **A logged-in request acts as whatever role the database currently says**, not whatever role was
  true at login checked on every request, so a role change or deactivation takes effect
  immediately instead of waiting for an existing session to expire.
- **A CSV export cell that starts with a formula-triggering character** neutralized in the code
  before it's written out. The database stores the original value untouched; this is purely an
  export-time concern.
- **An order can only be deleted while still `placed` or `accepted`** app-side, the same boundary
  as cancelling. The database has no idea what "deleted" means here it's `deletedAt` being set,
  never a real row delete.

## What's deliberately denormalized

`OrderLine.unitPrice` stores a copy of the menu item's price at the moment the line was added,
instead of always looking up the current `MenuItem.price`. If a manager changes a price later, old
orders keep showing what the customer actually agreed to pay at the time the alternative (always
joining to the live price) would silently rewrite history every time a price changed.

## What would break first at 100x the data

The docs don't directly answer this for the app as a whole, but they do say what happens to specific
queries without the right indexes which is the concrete version of the same question. Two indexes
went on `Order` (`status`, `createdAt`) once the order list needed to filter and sort by them:
without an index, a filtered or sorted request needs a full table scan, which is the difference
between a search that feels instant and one that doesn't once there are a lot of rows. A later audit
found four more missing indexes on columns that get hit on every order-visibility check, every
table-occupancy check, and every order-detail fetch: `Order.primaryWaiterId`, `Order.tableNumber`,
`OrderLine.orderId`, `OrderCollaborator.waiterId`. All four were added. Nothing was wrong with the
queries themselves Prisma doesn't add indexes automatically, so it's an easy thing to miss until a
query plan actually gets slow. One other real ceiling shows up in the docs, though not framed as a "100x data" answer: Supabase's
pooler connection limit was hit once during testing (capped at 15 connections in session mode), when
a leftover server process held a connection open. That's a concurrency/connection limit, not
something that scales with row count specifically, but it's the one other documented resource ceiling
in this project. Beyond that, there's no documented answer for what else would be first to break at
real data scale not filled in here rather than guessed at.
