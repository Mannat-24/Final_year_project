import { Router } from "express";
import {
  adminSchoolProfile,
  createManagedUser,
  createStudentProfile,
  createSubject,
  listStudentClasses,
  listStudents,
  listSubjects,
  listUsers,
  schoolAnalytics
} from "../controllers/adminController.js";
import { requireAuth, requireRoles } from "../middleware/authMiddleware.js";
import { validateRequest } from "../middleware/validateRequest.js";
import {
  createManagedUserValidator,
  createStudentValidator,
  createSubjectValidator
} from "../validators/commonValidators.js";

const router = Router();

router.use(requireAuth, requireRoles("admin"));

router.get("/school", adminSchoolProfile);

router.post("/users", createManagedUserValidator, validateRequest, createManagedUser);
router.get("/users", listUsers);

router.post("/students", createStudentValidator, validateRequest, createStudentProfile);
router.get("/students", listStudents);
router.get("/student-classes", listStudentClasses);

router.post("/subjects", createSubjectValidator, validateRequest, createSubject);
router.get("/subjects", listSubjects);

router.get("/analytics", schoolAnalytics);

export default router;
