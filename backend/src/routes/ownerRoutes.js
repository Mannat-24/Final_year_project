import { Router } from "express";
import {
  allowSchoolForAccess,
  createOwnerSchool,
  disallowSchoolForAccess,
  listOwnerSchools
} from "../controllers/ownerController.js";
import { requireAuth, requireRoles } from "../middleware/authMiddleware.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { createSchoolValidator } from "../validators/commonValidators.js";

const router = Router();

router.use(requireAuth, requireRoles("owner"));

router.get("/schools", listOwnerSchools);
router.post("/schools", createSchoolValidator, validateRequest, createOwnerSchool);
router.post("/schools/:schoolId/allow", allowSchoolForAccess);
router.delete("/schools/:schoolId/allow", disallowSchoolForAccess);

export default router;
