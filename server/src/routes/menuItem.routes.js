import { Router } from "express";
import { list, create, update, archive, unarchive } from "../controllers/menuItem.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, list);
router.post("/", requireAuth, requireRole("manager"), create);
router.patch("/:id", requireAuth, requireRole("manager"), update);
router.post("/:id/archive", requireAuth, requireRole("manager"), archive);
router.post("/:id/unarchive", requireAuth, requireRole("manager"), unarchive);

export default router;
