# Database Schema

This is what's actually in `server/prisma/schema.prisma`. If you want to see the raw SQL that got
run against Postgres, check `server/prisma/migrations/20260831094601_init/migration.sql`.

## The User table

Right now there's just one table.

| Field          | Type       | What it's for                                                    |
|----------------|------------|--------------------------------------------------------------------|
| `id`           | text (uuid) | the primary key — Prisma generates this uuid on the client side, it's not a Postgres auto-increment number. |
| `name`         | text        | just their display name, no length limit set.                    |
| `email`        | text        | has to be unique — Postgres itself enforces this with a unique index, not just app code. |
| `passwordHash` | text        | the bcrypt-hashed password. We never store or log the real password anywhere. |
| `role`         | enum        | either `manager` or `waiter`.                                     |
| `createdAt`    | timestamp   | set automatically when the row is created.                       |

And the role enum itself:

```prisma
enum Role {
  manager
  waiter
}
```

This is a real Postgres enum type, not just a text column with a check — so it's genuinely
impossible to put anything other than "manager" or "waiter" in that column, even by accident.

## The Menu Item table (added in Task 2)

Managers can add things to the menu now. Each menu item has:

- a name
- a price (stored as an exact number, not a rough decimal, so money never gets rounded wrong)
- whether it's currently available to order or not
- whether it's been archived (basically hidden, but not deleted — I kept it in the database so old
  orders that used it still make sense)
- when it was created and when it was last changed

Nothing gets deleted for real here. Archiving just hides an item from the everyday menu list, but a
manager can still look at archived items and bring one back if they change their mind.

## The Order table and Order Line table (added in Task 2)

An order belongs to one table in the restaurant and one waiter (whoever created it). It also has a
status — more on that below, since Task 3 built out the whole rules around that.

Each order can have many order lines, and each line is basically "this many of this menu item, with
this note." A line remembers the price the item had at the exact moment it was added to the order —
not whatever the menu item costs right now. That way, if a manager changes a price later, old orders
still show what the customer actually agreed to pay at the time.

A line can also be voided (basically cancelled) with a reason, if a waiter added the wrong thing by
mistake or a customer changed their mind. Voided lines never get removed from the database either —
they just get marked as voided so there's a record of what happened, and they stop counting toward
the order's total.

## Relations between tables

None yet — there's only the one table so far. This will obviously grow once menu items and orders
show up.

That was true back when there was only the User table. Since Task 2, a few real connections exist
now:

- One waiter can create many orders.
- One order can have many order lines.
- One menu item can show up on many order lines (since lots of orders can include the same dish).

Also worth knowing: if an order ever gets deleted, all of its lines get deleted along with it
automatically — I don't have to clean those up by hand, the database takes care of it.

## The OrderCollaborator table (added in Task 4)

Lets more than one waiter act on the same order. Each row just says "this waiter is attached to this
order":

- `orderId` and `waiterId` together form the primary key — a waiter can only be attached to the same
  order once, and the database itself won't allow a duplicate row, no app-side check needed for that
  part.
- `addedAt` — when they were added.

If the order gets deleted, its collaborator rows get deleted along with it automatically (same
cascading behavior as order lines).

## The Table table (added in Task 5)

A simple standalone list a manager maintains:

- `number` — has to be unique, enforced by the database with a unique index, same pattern as email
  on the User table.
- `isArchived` — same "soft delete" idea as menu items. Removing a table just hides it, it doesn't
  delete the row.
- `createdAt`.

This table doesn't have any foreign key pointing at it, and nothing points a foreign key back at
`Order` either — `Order.tableNumber` is still just a plain integer, unrelated at the database level
to this new table. Whether a table is "occupied" gets worked out by comparing `Table.number` against
the `tableNumber` on any order that's still open — that comparison happens in the code, not as a
database relationship.

## Where do I check things — the app or the database?

- **Role has to be valid**: checked in both places on purpose. The database physically can't store
  a bad role because of the enum type. But I also check it in the controller before it even gets
  that far, so a bad request comes back as a clean "role must be manager or waiter" message instead
  of some ugly database error.
- **Email has to be unique**: enforced by the database's unique index. On the app side, I don't
  bother checking "does this email already exist" before creating — I just try to create it, and if
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
  statuses, but it has no idea which order they're supposed to happen in — that logic lives in the
  code.
- **Voiding a line always needs a reason**: checked in the code — if you don't type a reason, the
  request gets rejected before it ever touches the database.
- **Who's allowed to act on an order (manager, primary waiter, or a collaborator)**: checked in the
  code, through one shared function instead of being copy-pasted into every route. The database has
  no idea collaborators mean anything special; it just stores the rows.
- **A table has to actually exist and not already be occupied before an order can be opened on it**:
  checked in the code, in `POST /api/orders`, every single time — not just something the frontend's
  table picker happens to prevent.
