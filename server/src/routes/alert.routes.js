import { Router } from "express";
import { listAlerts } from "../controllers/alert.controller.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, listAlerts);

export default router;
