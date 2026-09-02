import { Router } from "express";
import { listUnreadNotifications, markNotificationRead } from "../controllers/notification.controller.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/unread", requireAuth, listUnreadNotifications);
router.post("/:id/read", requireAuth, markNotificationRead);

export default router;
