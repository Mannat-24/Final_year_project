import { Router } from "express";
import { childProgress, downloadChildReport, parentDashboard } from "../controllers/parentController.js";
import { requireAuth, requireRoles } from "../middleware/authMiddleware.js";

const router = Router();

router.use(requireAuth, requireRoles("parent"));

router.get("/dashboard", parentDashboard);
router.get("/children/:studentId", childProgress);
router.get("/children/:studentId/report", downloadChildReport);

export default router;