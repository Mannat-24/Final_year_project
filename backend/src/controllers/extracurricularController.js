import { emitSchoolEvent, emitStudentEvent } from "../config/socket.js";
import { query } from "../config/db.js";
import { mapExtracurricularRow, mapStudentRow } from "../db/mappers.js";
import { buildPageMeta, getPagination } from "../utils/pagination.js";

const mapExtracurricularWithJoins = (row) => {
  const record = mapExtracurricularRow(row);

  return {
    ...record,
    studentId: {
      _id: row.student_id,
      fullName: row.student_full_name,
      admissionNumber: row.student_admission_number,
      grade: row.student_grade,
      section: row.student_section
    },
    teacherUserId: {
      _id: row.teacher_user_id,
      fullName: row.teacher_full_name,
      email: row.teacher_email
    }
  };
};

export const listExtracurricularRecords = async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);

  const whereParts = ["er.school_id = $1"];
  const params = [req.user.schoolId];

  if (req.query.studentId) {
    params.push(req.query.studentId);
    whereParts.push(`er.student_id = $${params.length}`);
  }

  const whereClause = `WHERE ${whereParts.join(" AND ")}`;
  const dataParams = [...params, limit, skip];

  const [itemsResult, totalResult] = await Promise.all([
    query(
      `SELECT
         er.*,
         st.full_name AS student_full_name,
         st.admission_number AS student_admission_number,
         st.grade AS student_grade,
         st.section AS student_section,
         tu.full_name AS teacher_full_name,
         tu.email AS teacher_email
       FROM extracurricular_records er
       INNER JOIN students st ON st.id = er.student_id
       INNER JOIN users tu ON tu.id = er.teacher_user_id
       ${whereClause}
       ORDER BY er.participation_date DESC, er.created_at DESC
       OFFSET $${dataParams.length}
       LIMIT $${dataParams.length - 1}`,
      dataParams
    ),
    query(
      `SELECT COUNT(*)::int AS count
       FROM extracurricular_records er
       ${whereClause}`,
      params
    )
  ]);

  const items = itemsResult.rows.map((row) => mapExtracurricularWithJoins(row));
  const total = Number(totalResult.rows[0]?.count || 0);

  return res.json({
    items,
    meta: buildPageMeta(page, limit, total)
  });
};

export const upsertExtracurricularRecord = async (req, res) => {
  const {
    recordId,
    studentId,
    activityType,
    activityName,
    level,
    participationDate,
    remarks
  } = req.body;

  const schoolId = req.user.schoolId;

  const studentResult = await query(
    `SELECT *
     FROM students
     WHERE id = $1
       AND school_id = $2
     LIMIT 1`,
    [studentId, schoolId]
  );

  if (!studentResult.rows.length) {
    return res.status(404).json({ message: "Student not found in your school" });
  }

  const student = mapStudentRow(studentResult.rows[0]);

  let row;

  if (recordId) {
    const updateResult = await query(
      `UPDATE extracurricular_records
       SET school_id = $1,
           student_id = $2,
           teacher_user_id = $3,
           activity_type = $4,
           activity_name = $5,
           level = $6,
           participation_date = $7,
           remarks = $8
       WHERE id = $9
         AND school_id = $1
       RETURNING *`,
      [
        schoolId,
        studentId,
        req.user._id,
        activityType,
        activityName,
        level || "School",
        new Date(participationDate),
        remarks || "",
        recordId
      ]
    );

    if (!updateResult.rows.length) {
      return res.status(404).json({ message: "Extracurricular record not found" });
    }

    row = updateResult.rows[0];
  } else {
    const insertResult = await query(
      `INSERT INTO extracurricular_records (
        school_id,
        student_id,
        teacher_user_id,
        activity_type,
        activity_name,
        level,
        participation_date,
        remarks
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        schoolId,
        studentId,
        req.user._id,
        activityType,
        activityName,
        level || "School",
        new Date(participationDate),
        remarks || ""
      ]
    );

    row = insertResult.rows[0];
  }

  const enrichedResult = await query(
    `SELECT
       er.*,
       st.full_name AS student_full_name,
       st.admission_number AS student_admission_number,
       st.grade AS student_grade,
       st.section AS student_section,
       tu.full_name AS teacher_full_name,
       tu.email AS teacher_email
     FROM extracurricular_records er
     INNER JOIN students st ON st.id = er.student_id
     INNER JOIN users tu ON tu.id = er.teacher_user_id
     WHERE er.id = $1`,
    [row.id]
  );

  const record = mapExtracurricularWithJoins(enrichedResult.rows[0]);

  const realtimePayload = {
    schoolId,
    studentId: student._id,
    record,
    updatedAt: new Date().toISOString()
  };

  emitSchoolEvent(String(schoolId), "extracurricular:updated", realtimePayload);
  emitStudentEvent(String(student._id), "extracurricular:updated", realtimePayload);

  return res.status(recordId ? 200 : 201).json({ record });
};
