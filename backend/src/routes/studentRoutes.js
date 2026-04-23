import { Router } from "express";
import {
  downloadStudentReport,
  listStudentAttendance,
  listStudentPerformance,
  studentDashboard,
  studentTimetable
} from "../controllers/studentController.js";
import { requireAuth, requireRoles } from "../middleware/authMiddleware.js";

const router = Router();

router.use(requireAuth, requireRoles("student"));

router.get("/dashboard", studentDashboard);
router.get("/performance", listStudentPerformance);
router.get("/attendance", listStudentAttendance);
router.get("/timetable", studentTimetable);
router.get("/report", downloadStudentReport);

export default router;
