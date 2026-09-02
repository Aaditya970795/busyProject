import { Router } from "express";
import { getSummary } from "../controllers/dashboard.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

// Assumption: the whole summary is manager-only (admin qualifies too, via the rank hierarchy),
// not just the waiter breakdown. Headline counts, revenue, and per-waiter comparisons all read
// as a management view — a waiter already has their own worklist via GET /orders/mine and
// doesn't need a restaurant-wide revenue/leaderboard number.
router.get("/summary", requireAuth, requireRole("manager"), getSummary);

export default router;
