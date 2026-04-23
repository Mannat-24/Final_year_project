import { Router } from "express";
import { chatWithAi } from "../controllers/aiController.js";
import { requireAuth, requireRoles } from "../middleware/authMiddleware.js";

const router = Router();

router.use(requireAuth, requireRoles("teacher", "student"));
router.post("/chat", chatWithAi);

export default router;
