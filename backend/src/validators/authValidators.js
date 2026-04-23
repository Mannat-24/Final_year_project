import { body } from "express-validator";

const roles = ["admin", "teacher", "student", "parent"];

export const registerValidator = [
  body("fullName").trim().isLength({ min: 2 }).withMessage("Full name is required"),
  body("email").trim().isEmail().withMessage("A valid email is required"),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters"),
  body("role").isIn(roles).withMessage("Invalid role"),
  body("schoolCode").trim().isLength({ min: 2 }).withMessage("schoolCode is required"),
  body("admissionNumber").optional().trim().isLength({ min: 2 }),
  body("childAdmissionNumbers").optional().isArray({ min: 1 })
];

export const loginValidator = [
  body("email").trim().isEmail().withMessage("A valid email is required"),
  body("password").isLength({ min: 1 }).withMessage("Password is required")
];