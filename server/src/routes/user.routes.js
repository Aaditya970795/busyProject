import { Router } from "express";
import { listUsers, createUser, updateRole, resetPassword } from "../controllers/user.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, listUsers);
// A manager can create a waiter; only an admin can create a manager (enforced inside the
// controller, since it depends on which role is being requested, not just who's calling).
router.post("/", requireAuth, requireRole("manager"), createUser);
router.patch("/:id/role", requireAuth, requireRole("admin"), updateRole);
// Same manager-can-only-touch-waiters, admin-can-touch-both split as createUser (checked inside
// the controller against the target's *current* role).
router.patch("/:id/password", requireAuth, requireRole("manager"), resetPassword);

export default router;
