import bcrypt from "bcryptjs";
import crypto from "crypto";
import { query, withTransaction } from "../config/db.js";
import { mapStudentRow, mapUserRow } from "../db/mappers.js";
import { signToken } from "../utils/jwt.js";

const publicUser = (user) => ({
  _id: user._id,
  fullName: user.fullName,
  email: user.email,
  role: user.role,
  schoolId: user.schoolId || null,
  studentProfileId: user.studentProfileId || null,
  childStudentIds: user.childStudentIds || []
});

const isSchoolAllowed = async (schoolId) => {
  if (!schoolId) return false;

  const { rows } = await query(
    `SELECT s.id
     FROM schools s
     INNER JOIN allowed_schools a ON a.school_id = s.id
     WHERE s.id = $1 AND s.is_active = TRUE
     LIMIT 1`,
    [schoolId]
  );

  return rows.length > 0;
};

const findStudentBySchoolAndAdmission = async (schoolId, admissionNumber) => {
  const { rows } = await query(
    `SELECT *
     FROM students
     WHERE school_id = $1 AND admission_number = $2
     LIMIT 1`,
    [schoolId, admissionNumber]
  );

  return rows.length ? mapStudentRow(rows[0]) : null;
};

export const register = async (req, res) => {
  const {
    fullName,
    email,
    password,
    role,
    schoolCode,
    admissionNumber,
    grade,
    section,
    childAdmissionNumbers
  } = req.body;

  const normalizedEmail = String(email || "").toLowerCase();
  const normalizedCode = String(schoolCode || "").toUpperCase();

  const schoolResult = await query(
    `SELECT *
     FROM schools
     WHERE code = $1 AND is_active = TRUE
     LIMIT 1`,
    [normalizedCode]
  );

  if (!schoolResult.rows.length) {
    return res.status(404).json({ message: "School not found or inactive" });
  }

  const school = schoolResult.rows[0];

  const schoolAllowed = await isSchoolAllowed(school.id);
  if (!schoolAllowed) {
    return res.status(403).json({ message: "This school code is not allowed by owner yet" });
  }

  const existingResult = await query(
    `SELECT id
     FROM users
     WHERE email = $1
     LIMIT 1`,
    [normalizedEmail]
  );

  if (existingResult.rows.length) {
    return res.status(409).json({ message: "Email already registered" });
  }

  let studentProfileId = null;
  let childStudentIds = [];

  if (role === "student") {
    if (!admissionNumber) {
      return res.status(400).json({ message: "admissionNumber is required for student role" });
    }

    const normalizedAdmission = String(admissionNumber).trim();
    let student = await findStudentBySchoolAndAdmission(school.id, normalizedAdmission);

    if (!student) {
      const createStudentResult = await query(
        `INSERT INTO students (
          school_id,
          admission_number,
          full_name,
          grade,
          section
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *`,
        [school.id, normalizedAdmission, fullName, grade || "NA", section || "A"]
      );

      student = mapStudentRow(createStudentResult.rows[0]);
    }

    studentProfileId = student._id;
  }

  if (role === "parent" && Array.isArray(childAdmissionNumbers) && childAdmissionNumbers.length) {
    const normalizedAdmissions = childAdmissionNumbers.map((item) => String(item).trim());

    const childrenResult = await query(
      `SELECT id
       FROM students
       WHERE school_id = $1
         AND admission_number = ANY($2::text[])`,
      [school.id, normalizedAdmissions]
    );

    childStudentIds = childrenResult.rows.map((row) => row.id);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const createdUser = await withTransaction(async (client) => {
    const userInsert = await client.query(
      `INSERT INTO users (
        full_name,
        email,
        password_hash,
        role,
        school_id,
        student_profile_id,
        child_student_ids
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::uuid[])
      RETURNING *`,
      [
        fullName,
        normalizedEmail,
        passwordHash,
        role,
        school.id,
        studentProfileId,
        childStudentIds
      ]
    );

    const user = mapUserRow(userInsert.rows[0]);

    if (role === "parent" && childStudentIds.length) {
      await client.query(
        `UPDATE students
         SET parent_user_ids = ARRAY(
           SELECT DISTINCT item
           FROM unnest(parent_user_ids || $1::uuid[]) AS item
         )
         WHERE id = ANY($2::uuid[])`,
        [[user._id], childStudentIds]
      );
    }

    return user;
  });

  const token = signToken(createdUser);

  return res.status(201).json({
    token,
    user: publicUser(createdUser)
  });
};

export const login = async (req, res) => {
  const { email, password } = req.body;

  const { rows } = await query(
    `SELECT *
     FROM users
     WHERE email = $1 AND is_active = TRUE
     LIMIT 1`,
    [String(email).toLowerCase()]
  );

  if (!rows.length) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const user = mapUserRow(rows[0]);

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  if (user.role !== "owner") {
    const schoolAllowed = await isSchoolAllowed(user.schoolId);
    if (!schoolAllowed) {
      return res.status(403).json({ message: "Login blocked. Your school is not allowed by owner" });
    }
  }

  const token = signToken(user);
  return res.json({ token, user: publicUser(user) });
};

export const forgotPassword = async (req, res) => {
  const email = String(req.body.email || "").toLowerCase().trim();
  if (!email) {
    return res.status(400).json({ message: "email is required" });
  }

  const { rows } = await query(
    `SELECT *
     FROM users
     WHERE email = $1 AND is_active = TRUE
     LIMIT 1`,
    [email]
  );

  if (!rows.length) {
    return res.json({ message: "If the email exists, a reset token has been generated" });
  }

  const user = mapUserRow(rows[0]);
  const resetToken = crypto.randomBytes(20).toString("hex");
  const passwordResetExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await query(
    `UPDATE users
     SET password_reset_token = $1,
         password_reset_expires_at = $2
     WHERE id = $3`,
    [resetToken, passwordResetExpiresAt, user._id]
  );

  return res.json({
    message: "Reset token generated (demo mode). Use this token on reset page.",
    resetToken,
    expiresAt: passwordResetExpiresAt.toISOString()
  });
};

export const resetPassword = async (req, res) => {
  const token = String(req.body.token || "").trim();
  const newPassword = String(req.body.newPassword || "");

  if (!token || !newPassword) {
    return res.status(400).json({ message: "token and newPassword are required" });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ message: "Password must be at least 8 characters" });
  }

  const { rows } = await query(
    `SELECT *
     FROM users
     WHERE password_reset_token = $1
       AND password_reset_expires_at > NOW()
       AND is_active = TRUE
     LIMIT 1`,
    [token]
  );

  if (!rows.length) {
    return res.status(400).json({ message: "Invalid or expired reset token" });
  }

  const user = mapUserRow(rows[0]);
  const passwordHash = await bcrypt.hash(newPassword, 12);

  await query(
    `UPDATE users
     SET password_hash = $1,
         password_reset_token = NULL,
         password_reset_expires_at = NULL
     WHERE id = $2`,
    [passwordHash, user._id]
  );

  return res.json({ message: "Password reset successful" });
};

export const me = async (req, res) => {
  return res.json({ user: req.user });
};
