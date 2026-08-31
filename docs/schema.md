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

## Relations between tables

None yet — there's only the one table so far. This will obviously grow once menu items and orders
show up.

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

## What would slow down first if this had 100x more users
