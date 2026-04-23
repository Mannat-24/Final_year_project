import { Router } from "express";
import {
  deleteTeacherTimetableSlot,
  listAttendanceRecords,
  listPerformanceRecords,
  teacherDashboard,
  teacherReferenceData,
  teacherTimetable,
  upsertAttendanceRecord,
  upsertPerformanceRecord,
  upsertTeacherTimetableSlot
} from "../controllers/teacherController.js";
import {
  listExtracurricularRecords,
  upsertExtracurricularRecord
} from "../controllers/extracurricularController.js";
import { requireAuth, requireRoles } from "../middleware/authMiddleware.js";
import { validateRequest } from "../middleware/validateRequest.js";
import {
  deleteTimetableSlotValidator,
  upsertAttendanceValidator,
  upsertExtracurricularValidator,
  upsertPerformanceValidator,
  upsertTimetableSlotValidator
} from "../validators/teacherValidators.js";

const router = Router();

router.use(requireAuth, requireRoles("teacher"));

router.get("/dashboard", teacherDashboard);
router.get("/reference", teacherReferenceData);
router.get("/performance", listPerformanceRecords);
router.get("/attendance", listAttendanceRecords);
router.get("/timetable", teacherTimetable);
router.get("/extracurricular", listExtracurricularRecords);

router.post("/performance", upsertPerformanceValidator, validateRequest, upsertPerformanceRecord);
router.post("/attendance", upsertAttendanceValidator, validateRequest, upsertAttendanceRecord);
router.post("/timetable/slot", upsertTimetableSlotValidator, validateRequest, upsertTeacherTimetableSlot);
router.post("/extracurricular", upsertExtracurricularValidator, validateRequest, upsertExtracurricularRecord);
router.delete("/timetable/slot", deleteTimetableSlotValidator, validateRequest, deleteTeacherTimetableSlot);

export default router;
