import { query } from "../config/db.js";
import { mapSchoolRow } from "../db/mappers.js";

export const createOwnerSchool = async (req, res) => {
  const {
    name,
    code,
    address = "",
    contactEmail = "",
    allowNow = true
  } = req.body;

  const normalizedCode = String(code || "").trim().toUpperCase();

  const existingResult = await query(
    `SELECT id
     FROM schools
     WHERE code = $1
     LIMIT 1`,
    [normalizedCode]
  );

  if (existingResult.rows.length) {
    return res.status(409).json({ message: "School code already exists" });
  }

  const schoolResult = await query(
    `INSERT INTO schools (
      name,
      code,
      address,
      contact_email
    )
    VALUES ($1, $2, $3, $4)
    RETURNING *`,
    [String(name).trim(), normalizedCode, String(address || "").trim(), String(contactEmail || "").trim()]
  );

  const school = mapSchoolRow(schoolResult.rows[0]);

  if (allowNow) {
    await query(
      `INSERT INTO allowed_schools (school_id, updated_by)
       VALUES ($1, $2)
       ON CONFLICT (school_id)
       DO UPDATE SET updated_by = EXCLUDED.updated_by`,
      [school._id, req.user._id]
    );
  }

  return res.status(201).json({
    _id: school._id,
    name: school.name,
    code: school.code,
    address: school.address,
    contactEmail: school.contactEmail,
    isActive: school.isActive,
    isAllowed: Boolean(allowNow),
    accountSummary: {
      totalAccounts: 0,
      admins: 0,
      teachers: 0,
      students: 0,
      parents: 0
    }
  });
};

export const listOwnerSchools = async (req, res) => {
  const { rows } = await query(
    `SELECT
       s.*,
       (a.school_id IS NOT NULL) AS is_allowed,
       COUNT(u.id)::int AS total_accounts,
       COUNT(*) FILTER (WHERE u.role = 'admin')::int AS admins,
       COUNT(*) FILTER (WHERE u.role = 'teacher')::int AS teachers,
       COUNT(*) FILTER (WHERE u.role = 'student')::int AS students,
       COUNT(*) FILTER (WHERE u.role = 'parent')::int AS parents
     FROM schools s
     LEFT JOIN allowed_schools a ON a.school_id = s.id
     LEFT JOIN users u ON u.school_id = s.id
     GROUP BY s.id, a.school_id
     ORDER BY s.created_at DESC`
  );

  const items = rows.map((row) => {
    const school = mapSchoolRow(row);
    return {
      _id: school._id,
      name: school.name,
      code: school.code,
      address: school.address,
      contactEmail: school.contactEmail,
      isActive: school.isActive,
      isAllowed: row.is_allowed,
      accountSummary: {
        totalAccounts: Number(row.total_accounts || 0),
        admins: Number(row.admins || 0),
        teachers: Number(row.teachers || 0),
        students: Number(row.students || 0),
        parents: Number(row.parents || 0)
      }
    };
  });

  return res.json({
    items,
    allowedCount: items.filter((item) => item.isAllowed).length,
    totalCount: items.length
  });
};

export const allowSchoolForAccess = async (req, res) => {
  const schoolResult = await query(
    `SELECT *
     FROM schools
     WHERE id = $1
     LIMIT 1`,
    [req.params.schoolId]
  );

  if (!schoolResult.rows.length) {
    return res.status(404).json({ message: "School not found" });
  }

  const school = mapSchoolRow(schoolResult.rows[0]);

  await query(
    `INSERT INTO allowed_schools (school_id, updated_by)
     VALUES ($1, $2)
     ON CONFLICT (school_id)
     DO UPDATE SET updated_by = EXCLUDED.updated_by`,
    [school._id, req.user._id]
  );

  return res.json({ message: `School ${school.code} is now allowed for login/signup` });
};

export const disallowSchoolForAccess = async (req, res) => {
  const schoolResult = await query(
    `SELECT *
     FROM schools
     WHERE id = $1
     LIMIT 1`,
    [req.params.schoolId]
  );

  if (!schoolResult.rows.length) {
    return res.status(404).json({ message: "School not found" });
  }

  const school = mapSchoolRow(schoolResult.rows[0]);

  await query(
    `DELETE FROM allowed_schools
     WHERE school_id = $1`,
    [school._id]
  );

  return res.json({ message: `School ${school.code} has been removed from allowlist` });
};
