import { Router } from "express";
import {
  createOrder,
  listOrders,
  listMyOrders,
  listDeletedOrders,
  exportOrders,
  getOrder,
  updateStatus,
  addLine,
  voidLine,
  addCollaborator,
  addNote,
  getTimeline,
  acknowledgeAlert,
  archiveOrder,
  unarchiveOrder,
  deleteOrder,
} from "../controllers/order.controller.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.post("/", requireAuth, createOrder);
router.get("/", requireAuth, listOrders);
router.get("/mine", requireAuth, listMyOrders);
// Registered before /:id so a request for "/export"/"/deleted" doesn't match :id first.
router.get("/export", requireAuth, exportOrders);
router.get("/deleted", requireAuth, listDeletedOrders);
router.get("/:id", requireAuth, getOrder);
router.patch("/:id/status", requireAuth, updateStatus);
router.post("/:id/lines", requireAuth, addLine);
router.post("/:id/lines/:lineId/void", requireAuth, voidLine);
router.post("/:id/collaborators", requireAuth, addCollaborator);
router.post("/:id/notes", requireAuth, addNote);
router.get("/:id/timeline", requireAuth, getTimeline);
router.post("/:id/acknowledge-alert", requireAuth, acknowledgeAlert);
router.post("/:id/archive", requireAuth, archiveOrder);
router.post("/:id/unarchive", requireAuth, unarchiveOrder);
router.delete("/:id", requireAuth, deleteOrder);

export default router;
