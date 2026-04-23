import { body, param } from "express-validator";

export const uuidParam = (name) =>
  param(name).isUUID().withMessage(`${name} must be a valid UUID`);

export const createSchoolValidator = [
  body("name").trim().isLength({ min: 2 }).withMessage("School name is required"),
  body("code").trim().isLength({ min: 2 }).withMessage("School code is required"),
  body("address").optional().isString(),
  body("contactEmail").optional().isEmail().withMessage("contactEmail must be valid")
];

export const createStudentValidator = [
  body("fullName").trim().isLength({ min: 2 }).withMessage("Student name is required"),
  body("admissionNumber").trim().isLength({ min: 2 }).withMessage("Admission number is required"),
  body("grade").trim().isLength({ min: 1 }).withMessage("Grade is required"),
  body("section").optional().trim().isLength({ min: 1 }),
  body("parentUserIds").optional().isArray(),
  body("parentUserIds.*").optional().isUUID().withMessage("Each parentUserId must be a valid UUID"),
  body("teacherUserIds").optional().isArray(),
  body("teacherUserIds.*").optional().isUUID().withMessage("Each teacherUserId must be a valid UUID")
];

export const createSubjectValidator = [
  body("name").trim().isLength({ min: 2 }).withMessage("Subject name is required"),
  body("code").trim().isLength({ min: 2 }).withMessage("Subject code is required"),
  body("teacherUserId").optional().isUUID().withMessage("teacherUserId must be valid")
];

export const createManagedUserValidator = [
  body("fullName").trim().isLength({ min: 2 }).withMessage("fullName is required"),
  body("email").trim().isEmail().withMessage("Valid email is required"),
  body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
  body("role").isIn(["admin", "teacher", "student", "parent"]).withMessage("Invalid role"),
  body("studentProfileId").optional().isUUID(),
  body("childStudentIds").optional().isArray(),
  body("childStudentIds.*").optional().isUUID().withMessage("Each childStudentId must be a valid UUID")
];
