// Wipes all test/junk data accumulated across development, and reseeds clean, realistic sample
// data — except for one account, preserved byte-for-byte (see PRESERVE_EMAIL below).
//
// Run with: npm run reset-demo-data
//
// Everything below runs inside a single prisma.$transaction: if anything fails partway through,
// nothing commits — the database is left exactly as it was before this script ran.
import bcrypt from "bcrypt";
import { prisma } from "../src/lib/prisma.js";

const PRESERVE_EMAIL = "aadityat970@gmail.com";
const SALT_ROUNDS = 10; // matches server/src/controllers/user.controller.js
const SEED_PASSWORD = "password123"; // same convention as the existing demo accounts

const TABLE_NUMBERS_TO_ENSURE = [1, 2, 3, 4, 5, 6, 7, 8]; // additive only — never deletes a table

const WAITERS = [
  { name: "Priya Sharma", email: "priya.sharma@test.com" },
  { name: "Rahul Verma", email: "rahul.verma@test.com" },
  { name: "Sara Khan", email: "sara.khan@test.com" },
  { name: "Amit Singh", email: "amit.singh@test.com" },
];

const MENU_ITEMS = [
  // Starters
  { name: "Paneer Tikka", price: "220.00" },
  { name: "Chicken Seekh Kebab", price: "260.00", isAvailable: false },
  { name: "Veg Spring Rolls", price: "180.00" },
  { name: "Garlic Bread", price: "150.00" },
  // Mains
  { name: "Butter Chicken", price: "350.00" },
  { name: "Paneer Butter Masala", price: "300.00" },
  { name: "Dal Makhani", price: "220.00" },
  { name: "Chicken Biryani", price: "320.00", isAvailable: false },
  { name: "Margherita Pizza", price: "280.00" },
  // Drinks
  { name: "Masala Chai", price: "60.00" },
  { name: "Fresh Lime Soda", price: "90.00" },
  { name: "Mango Lassi", price: "120.00" },
  // Desserts
  { name: "Gulab Jamun", price: "110.00" },
  { name: "Chocolate Brownie", price: "160.00" },
];

function minutesAgo(n) {
  return new Date(Date.now() - n * 60 * 1000);
}
function daysAgoAt(days, hourUtc) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(hourUtc, 0, 0, 0);
  return d;
}

// Creates one order with a believable audit trail behind it — every status change, line add, and
// void produces the matching OrderEvent, just like the real API does. Never inserts an order
// directly into a terminal status without walking it there.
async function seedOrder(
  tx,
  { tableNumber, waiterId, createdAt, lines, statusSteps = [], stepMinutesApart = 8, voidLineAt, collaboratorId }
) {
  const order = await tx.order.create({
    data: { tableNumber, primaryWaiterId: waiterId, status: "placed", createdAt, updatedAt: createdAt },
  });

  const createdLines = [];
  for (const line of lines) {
    const created = await tx.orderLine.create({
      data: {
        orderId: order.id,
        menuItemId: line.item.id,
        quantity: line.quantity,
        specialInstructions: line.instructions ?? null,
        unitPrice: line.item.price,
        createdAt,
      },
      include: { menuItem: true },
    });
    createdLines.push(created);
    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        eventType: "line_added",
        newValue: `${created.menuItem.name} x${created.quantity}`,
        actorId: waiterId,
        createdAt,
      },
    });
  }

  if (collaboratorId) {
    await tx.orderCollaborator.create({ data: { orderId: order.id, waiterId: collaboratorId, addedAt: createdAt } });
  }

  let status = "placed";
  let at = createdAt;
  for (const nextStatus of statusSteps) {
    at = new Date(at.getTime() + stepMinutesApart * 60 * 1000);
    await tx.order.update({ where: { id: order.id }, data: { status: nextStatus, updatedAt: at } });
    await tx.orderEvent.create({
      data: { orderId: order.id, eventType: "status_change", oldValue: status, newValue: nextStatus, actorId: waiterId, createdAt: at },
    });
    status = nextStatus;
  }

  if (voidLineAt) {
    const line = createdLines[voidLineAt.lineIndex];
    const voidAt = new Date(createdAt.getTime() + (voidLineAt.minutesAfterCreate ?? 5) * 60 * 1000);
    await tx.orderLine.update({ where: { id: line.id }, data: { status: "void", voidReason: voidLineAt.reason } });
    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        eventType: "line_voided",
        newValue: `${line.menuItem.name} x${line.quantity}`,
        note: voidLineAt.reason,
        actorId: waiterId,
        createdAt: voidAt,
      },
    });
  }

  return order;
}

async function main() {
  const preserved = await prisma.user.findUnique({ where: { email: PRESERVE_EMAIL } });
  if (!preserved) throw new Error(`Preserved account ${PRESERVE_EMAIL} not found — aborting, nothing touched.`);
  const preservedSnapshot = { ...preserved };

  // Explicit generous timeout: this transaction makes ~200 sequential round trips to build a
  // believable audit trail for every seeded order, against a remote Supabase instance — Prisma's
  // default 5s interactive-transaction timeout would kill it partway through otherwise.
  const result = await prisma.$transaction(async (tx) => {
    // 1. Delete children-before-parents, everything except the preserved user.
    await tx.notification.deleteMany({});
    await tx.orderEvent.deleteMany({});
    await tx.orderLine.deleteMany({});
    await tx.orderCollaborator.deleteMany({});
    await tx.order.deleteMany({});
    await tx.menuItem.deleteMany({});
    await tx.user.deleteMany({ where: { email: { not: PRESERVE_EMAIL } } });

    // 2. Tables — additive only, never deletes an existing row.
    for (const number of TABLE_NUMBERS_TO_ENSURE) {
      await tx.table.upsert({ where: { number }, update: {}, create: { number } });
    }

    // 3. Waiters.
    const waiters = [];
    for (const w of WAITERS) {
      const passwordHash = await bcrypt.hash(SEED_PASSWORD, SALT_ROUNDS);
      const user = await tx.user.create({ data: { name: w.name, email: w.email, passwordHash, role: "waiter" } });
      waiters.push(user);
    }
    const [w1, w2, w3, w4] = waiters;

    // 4. Menu items.
    const menuItems = [];
    for (const m of MENU_ITEMS) {
      const item = await tx.menuItem.create({
        data: { name: m.name, price: m.price, isAvailable: m.isAvailable ?? true },
      });
      menuItems.push(item);
    }
    const byName = (name) => menuItems.find((m) => m.name === name);

    // 5. Orders — historical (last 6 days) + today.
    await seedOrder(tx, {
      tableNumber: 3,
      waiterId: w1.id,
      createdAt: daysAgoAt(6, 12),
      lines: [{ item: byName("Butter Chicken"), quantity: 2 }, { item: byName("Masala Chai"), quantity: 2 }],
      statusSteps: ["accepted", "preparing", "ready", "served"],
    });

    await seedOrder(tx, {
      tableNumber: 4,
      waiterId: w2.id,
      createdAt: daysAgoAt(5, 13),
      lines: [{ item: byName("Paneer Tikka"), quantity: 1 }, { item: byName("Margherita Pizza"), quantity: 1 }],
      statusSteps: ["accepted", "preparing", "ready", "served"],
    });

    await seedOrder(tx, {
      tableNumber: 5,
      waiterId: w1.id,
      createdAt: daysAgoAt(5, 19),
      lines: [{ item: byName("Margherita Pizza"), quantity: 1 }, { item: byName("Fresh Lime Soda"), quantity: 2 }],
      statusSteps: ["accepted", "preparing", "ready", "served"],
      voidLineAt: { lineIndex: 1, reason: "Wrong item punched in", minutesAfterCreate: 4 },
    });

    await seedOrder(tx, {
      tableNumber: 1,
      waiterId: w3.id,
      createdAt: daysAgoAt(4, 12),
      lines: [{ item: byName("Chicken Biryani"), quantity: 1 }, { item: byName("Gulab Jamun"), quantity: 2 }],
      statusSteps: ["accepted", "preparing", "ready", "served"],
    });

    await seedOrder(tx, {
      tableNumber: 2,
      waiterId: w2.id,
      createdAt: daysAgoAt(4, 18),
      lines: [{ item: byName("Dal Makhani"), quantity: 1 }, { item: byName("Garlic Bread"), quantity: 1 }],
      statusSteps: ["cancelled"],
    });

    await seedOrder(tx, {
      tableNumber: 6,
      waiterId: w4.id,
      createdAt: daysAgoAt(3, 12),
      lines: [{ item: byName("Paneer Butter Masala"), quantity: 2 }, { item: byName("Mango Lassi"), quantity: 2 }],
      statusSteps: ["accepted", "preparing", "ready", "served"],
      collaboratorId: w1.id,
    });

    await seedOrder(tx, {
      tableNumber: 7,
      waiterId: w1.id,
      createdAt: daysAgoAt(3, 20),
      lines: [{ item: byName("Veg Spring Rolls"), quantity: 2 }],
      statusSteps: ["accepted", "preparing", "ready", "served"],
    });

    await seedOrder(tx, {
      tableNumber: 3,
      waiterId: w3.id,
      createdAt: daysAgoAt(2, 13),
      lines: [{ item: byName("Butter Chicken"), quantity: 1 }, { item: byName("Chocolate Brownie"), quantity: 1 }],
      statusSteps: ["accepted", "preparing", "ready", "served"],
    });

    await seedOrder(tx, {
      tableNumber: 8,
      waiterId: w4.id,
      createdAt: daysAgoAt(2, 19),
      lines: [{ item: byName("Margherita Pizza"), quantity: 2 }, { item: byName("Fresh Lime Soda"), quantity: 1 }],
      statusSteps: ["cancelled"],
    });

    await seedOrder(tx, {
      tableNumber: 4,
      waiterId: w2.id,
      createdAt: daysAgoAt(1, 12),
      lines: [{ item: byName("Chicken Seekh Kebab"), quantity: 2 }],
      statusSteps: ["accepted", "preparing", "ready", "served"],
      voidLineAt: { lineIndex: 0, reason: "Kitchen ran out", minutesAfterCreate: 6 },
    });

    await seedOrder(tx, {
      tableNumber: 5,
      waiterId: w3.id,
      createdAt: daysAgoAt(1, 20),
      lines: [{ item: byName("Paneer Tikka"), quantity: 1 }, { item: byName("Masala Chai"), quantity: 1 }],
      statusSteps: ["accepted", "preparing", "ready", "served"],
      collaboratorId: w4.id,
    });

    // Today.
    await seedOrder(tx, {
      tableNumber: 1,
      waiterId: w1.id,
      createdAt: minutesAgo(90),
      lines: [{ item: byName("Dal Makhani"), quantity: 1 }],
      statusSteps: ["accepted", "preparing", "ready", "served"],
      stepMinutesApart: 12,
    });

    await seedOrder(tx, {
      tableNumber: 2,
      waiterId: w2.id,
      createdAt: minutesAgo(20),
      lines: [{ item: byName("Dal Makhani"), quantity: 2 }],
      statusSteps: ["accepted", "preparing", "ready"],
      stepMinutesApart: 5,
    });

    await seedOrder(tx, {
      tableNumber: 6,
      waiterId: w4.id,
      createdAt: minutesAgo(18),
      lines: [{ item: byName("Paneer Butter Masala"), quantity: 1 }],
      statusSteps: ["accepted", "preparing", "ready"],
      stepMinutesApart: 5,
    });

    await seedOrder(tx, {
      tableNumber: 7,
      waiterId: w3.id,
      createdAt: minutesAgo(4),
      lines: [{ item: byName("Butter Chicken"), quantity: 2 }],
      statusSteps: [],
    });

    // Guaranteed slow-order alert: "preparing" (never auto-cleared, unlike placed/accepted) and
    // created 35 minutes ago — past both SLOW_ORDER_MINUTES (15) and CRITICAL_ORDER_MINUTES (30).
    const alertOrder = await seedOrder(tx, {
      tableNumber: 8,
      waiterId: w1.id,
      createdAt: minutesAgo(35),
      lines: [{ item: byName("Margherita Pizza"), quantity: 1 }],
      statusSteps: ["accepted", "preparing"],
      stepMinutesApart: 10,
    });

    return { waiters, menuItems, alertOrderId: alertOrder.id };
  }, { timeout: 120000, maxWait: 20000 });

  // Re-verify the preserved account is byte-for-byte unchanged.
  const after = await prisma.user.findUnique({ where: { email: PRESERVE_EMAIL } });
  const unchanged =
    after &&
    after.id === preservedSnapshot.id &&
    after.name === preservedSnapshot.name &&
    after.email === preservedSnapshot.email &&
    after.passwordHash === preservedSnapshot.passwordHash &&
    after.role === preservedSnapshot.role;

  console.log(unchanged ? "✔ Preserved account verified unchanged." : "✘ PRESERVED ACCOUNT CHANGED — investigate immediately.");
  console.log("\nSeeded waiters (all use the same password for this demo batch):");
  for (const w of result.waiters) {
    console.log(`  ${w.name.padEnd(14)} ${w.email.padEnd(24)} password: ${SEED_PASSWORD}`);
  }
  console.log(`\nMenu items seeded: ${result.menuItems.length}`);
  console.log(`Alert-tripping order id: ${result.alertOrderId} (table 8, status "preparing", 35 min old)`);
}

main()
  .catch((err) => {
    console.error("Reset/reseed failed — transaction rolled back, nothing was changed:\n", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
