import { Router } from "express";
import { predictRisk, predictRiskForStudent } from "../controllers/mlController.js";
import { requireAuth, requireRoles } from "../middleware/authMiddleware.js";

const router = Router();

router.use(requireAuth);
router.post("/predict", predictRisk);
router.get("/predict/student/:studentId", requireRoles("teacher", "admin"), predictRiskForStudent);

export default router;