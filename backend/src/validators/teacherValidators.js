import { body } from "express-validator";

const dayValues = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const upsertPerformanceValidator = [
  body("studentId").isMongoId().withMessage("studentId is required"),
  body("subjectId").isMongoId().withMessage("subjectId is required"),
  body("examType").trim().isLength({ min: 1 }).withMessage("examType is required"),
  body("marksObtained").isFloat({ min: 0 }).withMessage("marksObtained must be >= 0"),
  body("maxMarks").isFloat({ min: 1 }).withMessage("maxMarks must be >= 1"),
  body("examDate").isISO8601().withMessage("examDate must be a valid ISO date"),
  body("remark").optional().isString()
];

export const upsertAttendanceValidator = [
  body("studentId").isMongoId().withMessage("studentId is required"),
  body("date").isISO8601().withMessage("date must be valid ISO date"),
  body("status").isIn(["Present", "Absent", "Late"]).withMessage("Invalid status"),
  body("remark").optional().isString()
];

export const upsertTimetableSlotValidator = [
  body("className").trim().isLength({ min: 2 }).withMessage("className is required"),
  body("dayOfWeek").isIn(dayValues).withMessage("dayOfWeek is invalid"),
  body("periodNo").isInt({ min: 1, max: 20 }).withMessage("periodNo must be between 1 and 20"),
  body("startTime").matches(/^([01]\d|2[0-3]):([0-5]\d)$/).withMessage("startTime must be HH:mm"),
  body("endTime").matches(/^([01]\d|2[0-3]):([0-5]\d)$/).withMessage("endTime must be HH:mm"),
  body("subjectName").trim().isLength({ min: 2 }).withMessage("subjectName is required"),
  body("roomLabel").optional().isString()
];

export const deleteTimetableSlotValidator = [
  body("className").trim().isLength({ min: 2 }).withMessage("className is required"),
  body("dayOfWeek").isIn(dayValues).withMessage("dayOfWeek is invalid"),
  body("periodNo").isInt({ min: 1, max: 20 }).withMessage("periodNo must be between 1 and 20")
];

export const upsertExtracurricularValidator = [
  body("recordId").optional().isMongoId().withMessage("recordId must be a valid MongoId"),
  body("studentId").isMongoId().withMessage("studentId is required"),
  body("activityType").trim().isLength({ min: 2 }).withMessage("activityType is required"),
  body("activityName").trim().isLength({ min: 2 }).withMessage("activityName is required"),
  body("level").optional().trim().isLength({ min: 2 }),
  body("participationDate").isISO8601().withMessage("participationDate must be a valid ISO date"),
  body("remarks").optional().isString()
];
