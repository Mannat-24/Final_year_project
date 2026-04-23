import bcrypt from "bcryptjs";
import { query, withTransaction } from "../config/db.js";
import { mapSchoolRow, mapStudentRow, mapSubjectRow, mapUserRow } from "../db/mappers.js";
import { getSchoolAnalytics } from "../services/analyticsService.js";
import { buildPageMeta, getPagination } from "../utils/pagination.js";

const toPublicUser = (item) => ({
  _id: item._id,
  fullName: item.fullName,
  email: item.email,
  role: item.role,
  schoolId: item.schoolId,
  studentProfileId: item.studentProfileId || null,
  childStudentIds: item.childStudentIds || [],
  isActive: item.isActive
});

export const adminSchoolProfile = async (req, res) => {
  const schoolId = req.user.schoolId;

  const [schoolResult, roleCountsResult, studentCountResult, subjectCountResult] = await Promise.all([
    query(
      `SELECT *
       FROM schools
       WHERE id = $1
       LIMIT 1`,
      [schoolId]
    ),
    query(
      `SELECT role, COUNT(*)::int AS count
       FROM users
       WHERE school_id = $1
       GROUP BY role`,
      [schoolId]
    ),
    query(
      `SELECT COUNT(*)::int AS count
       FROM students
       WHERE school_id = $1`,
      [schoolId]
    ),
    query(
      `SELECT COUNT(*)::int AS count
       FROM subjects
       WHERE school_id = $1`,
      [schoolId]
    )
  ]);

  if (!schoolResult.rows.length) {
    return res.status(404).json({ message: "School not found for admin account" });
  }

  const school = mapSchoolRow(schoolResult.rows[0]);

  const summary = {
    admins: 0,
    teachers: 0,
    students: 0,
    parents: 0
  };

  roleCountsResult.rows.forEach((item) => {
    if (item.role === "admin") summary.admins = item.count;
    if (item.role === "teacher") summary.teachers = item.count;
    if (item.role === "student") summary.students = item.count;
    if (item.role === "parent") summary.parents = item.count;
  });

  const studentCount = Number(studentCountResult.rows[0]?.count || 0);
  const subjectCount = Number(subjectCountResult.rows[0]?.count || 0);

  return res.json({
    school: {
      _id: school._id,
      name: school.name,
      code: school.code,
      address: school.address,
      contactEmail: school.contactEmail
    },
    summary: {
      ...summary,
      studentProfiles: studentCount,
      subjects: subjectCount,
      totalUsers: summary.admins + summary.teachers + summary.students + summary.parents
    }
  });
};

export const createManagedUser = async (req, res) => {
  const { fullName, email, password, role, studentProfileId, childStudentIds = [] } = req.body;
  const normalizedEmail = String(email || "").toLowerCase();

  const existingResult = await query(
    `SELECT id
     FROM users
     WHERE email = $1
     LIMIT 1`,
    [normalizedEmail]
  );

  if (existingResult.rows.length) {
    return res.status(409).json({ message: "Email already in use" });
  }

  if (studentProfileId) {
    const studentResult = await query(
      `SELECT id
       FROM students
       WHERE id = $1 AND school_id = $2
       LIMIT 1`,
      [studentProfileId, req.user.schoolId]
    );

    if (!studentResult.rows.length) {
      return res.status(400).json({ message: "studentProfileId does not belong to your school" });
    }
  }

  if (childStudentIds.length) {
    const validResult = await query(
      `SELECT COUNT(*)::int AS count
       FROM students
       WHERE id = ANY($1::uuid[]) AND school_id = $2`,
      [childStudentIds, req.user.schoolId]
    );

    const validCount = Number(validResult.rows[0]?.count || 0);
    if (validCount !== childStudentIds.length) {
      return res.status(400).json({ message: "One or more childStudentIds are invalid" });
    }
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await withTransaction(async (client) => {
    const insertResult = await client.query(
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
        req.user.schoolId,
        studentProfileId || null,
        childStudentIds
      ]
    );

    const mappedUser = mapUserRow(insertResult.rows[0]);

    if (role === "parent" && childStudentIds.length) {
      await client.query(
        `UPDATE students
         SET parent_user_ids = ARRAY(
           SELECT DISTINCT item
           FROM unnest(parent_user_ids || $1::uuid[]) AS item
         )
         WHERE id = ANY($2::uuid[])`,
        [[mappedUser._id], childStudentIds]
      );
    }

    return mappedUser;
  });

  return res.status(201).json(toPublicUser(user));
};

export const listUsers = async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);

  const whereParts = ["school_id = $1"];
  const params = [req.user.schoolId];

  if (req.query.role) {
    params.push(req.query.role);
    whereParts.push(`role = $${params.length}`);
  }

  const whereClause = `WHERE ${whereParts.join(" AND ")}`;

  const dataParams = [...params, limit, skip];
  const [itemsResult, totalResult] = await Promise.all([
    query(
      `SELECT *
       FROM users
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${dataParams.length - 1}
       OFFSET $${dataParams.length}`,
      dataParams
    ),
    query(
      `SELECT COUNT(*)::int AS count
       FROM users
       ${whereClause}`,
      params
    )
  ]);

  const items = itemsResult.rows.map((row) => {
    const user = mapUserRow(row);
    return {
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      schoolId: user.schoolId,
      studentProfileId: user.studentProfileId,
      childStudentIds: user.childStudentIds,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  });

  const total = Number(totalResult.rows[0]?.count || 0);

  return res.json({
    items,
    meta: buildPageMeta(page, limit, total)
  });
};

export const createStudentProfile = async (req, res) => {
  const { fullName, admissionNumber, grade, section, dateOfBirth, parentUserIds = [], teacherUserIds = [] } = req.body;

  const normalizedAdmissionNumber = String(admissionNumber).trim();

  const duplicateResult = await query(
    `SELECT id
     FROM students
     WHERE school_id = $1 AND admission_number = $2
     LIMIT 1`,
    [req.user.schoolId, normalizedAdmissionNumber]
  );

  if (duplicateResult.rows.length) {
    return res.status(409).json({ message: "admissionNumber already exists in this school" });
  }

  const studentResult = await query(
    `INSERT INTO students (
      school_id,
      full_name,
      admission_number,
      grade,
      section,
      date_of_birth,
      parent_user_ids,
      teacher_user_ids
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7::uuid[], $8::uuid[])
    RETURNING *`,
    [
      req.user.schoolId,
      fullName,
      normalizedAdmissionNumber,
      grade,
      section || "A",
      dateOfBirth || null,
      parentUserIds,
      teacherUserIds
    ]
  );

  return res.status(201).json(mapStudentRow(studentResult.rows[0]));
};

export const listStudents = async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);

  const whereParts = ["school_id = $1"];
  const params = [req.user.schoolId];

  if (req.query.grade) {
    params.push(req.query.grade);
    whereParts.push(`grade = $${params.length}`);
  }

  if (req.query.section) {
    params.push(req.query.section);
    whereParts.push(`section = $${params.length}`);
  }

  const whereClause = `WHERE ${whereParts.join(" AND ")}`;

  const dataParams = [...params, limit, skip];

  const [itemsResult, totalResult] = await Promise.all([
    query(
      `SELECT *
       FROM students
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${dataParams.length - 1}
       OFFSET $${dataParams.length}`,
      dataParams
    ),
    query(
      `SELECT COUNT(*)::int AS count
       FROM students
       ${whereClause}`,
      params
    )
  ]);

  const items = itemsResult.rows.map((row) => mapStudentRow(row));
  const total = Number(totalResult.rows[0]?.count || 0);

  return res.json({
    items,
    meta: buildPageMeta(page, limit, total)
  });
};

export const listStudentClasses = async (req, res) => {
  const { rows } = await query(
    `SELECT grade, section, COUNT(*)::int AS count
     FROM students
     WHERE school_id = $1
     GROUP BY grade, section
     ORDER BY grade, section`,
    [req.user.schoolId]
  );

  const items = rows.map((row) => ({
    grade: row.grade,
    section: row.section,
    count: Number(row.count || 0)
  }));

  return res.json({ items });
};

export const createSubject = async (req, res) => {
  const { name, code, teacherUserId } = req.body;
  const normalizedCode = String(code).toUpperCase();

  const duplicateResult = await query(
    `SELECT id
     FROM subjects
     WHERE school_id = $1 AND code = $2
     LIMIT 1`,
    [req.user.schoolId, normalizedCode]
  );

  if (duplicateResult.rows.length) {
    return res.status(409).json({ message: "Subject code already exists in this school" });
  }

  const subjectResult = await query(
    `INSERT INTO subjects (
      school_id,
      name,
      code,
      teacher_user_id
    )
    VALUES ($1, $2, $3, $4)
    RETURNING *`,
    [req.user.schoolId, name, normalizedCode, teacherUserId || null]
  );

  return res.status(201).json(mapSubjectRow(subjectResult.rows[0]));
};

export const listSubjects = async (req, res) => {
  const { rows } = await query(
    `SELECT *
     FROM subjects
     WHERE school_id = $1
     ORDER BY name ASC`,
    [req.user.schoolId]
  );

  const items = rows.map((row) => mapSubjectRow(row));
  return res.json({ items });
};

export const schoolAnalytics = async (req, res) => {
  const analytics = await getSchoolAnalytics(req.user.schoolId);
  return res.json(analytics);
};
