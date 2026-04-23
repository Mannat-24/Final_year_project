import { query } from "../config/db.js";
import { mapAttendanceRow, mapNotificationRow, mapSchoolRow, mapStudentRow } from "../db/mappers.js";
import { evaluateStudentInsights } from "../services/insightService.js";
import { buildStudentReportPdf } from "../services/reportService.js";
import { buildPageMeta, getPagination } from "../utils/pagination.js";

const dayOrder = {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6
};

const toClassName = (grade, section) => `Class ${String(grade).trim()}-${String(section || "A").trim()}`;

const mapPerformanceWithSubject = (row) => ({
  _id: row.id,
  schoolId: row.school_id,
  studentId: row.student_id,
  subjectId: {
    _id: row.subject_id,
    name: row.subject_name,
    code: row.subject_code
  },
  teacherUserId: row.teacher_user_id,
  examType: row.exam_type,
  marksObtained: Number(row.marks_obtained),
  maxMarks: Number(row.max_marks),
  examDate: row.exam_date,
  remark: row.remark || "",
  riskLevel: row.risk_level || "Low",
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const resolveStudentForUser = async (user) => {
  if (!user.studentProfileId) return null;

  const { rows } = await query(
    `SELECT *
     FROM students
     WHERE id = $1
       AND school_id = $2
     LIMIT 1`,
    [user.studentProfileId, user.schoolId]
  );

  if (!rows.length) return null;
  return mapStudentRow(rows[0]);
};

export const studentDashboard = async (req, res) => {
  const student = await resolveStudentForUser(req.user);
  if (!student) {
    return res.status(404).json({ message: "Student profile not linked for this account" });
  }

  const [insightData, performanceResult, attendanceResult, notificationsResult] = await Promise.all([
    evaluateStudentInsights({ schoolId: req.user.schoolId, studentId: student._id, notify: false }),
    query(
      `SELECT
         pr.*,
         subj.name AS subject_name,
         subj.code AS subject_code
       FROM performance_records pr
       INNER JOIN subjects subj ON subj.id = pr.subject_id
       WHERE pr.school_id = $1
         AND pr.student_id = $2
       ORDER BY pr.exam_date DESC
       LIMIT 12`,
      [req.user.schoolId, student._id]
    ),
    query(
      `SELECT *
       FROM attendance_records
       WHERE school_id = $1
         AND student_id = $2
       ORDER BY date DESC
       LIMIT 20`,
      [req.user.schoolId, student._id]
    ),
    query(
      `SELECT *
       FROM notifications
       WHERE recipient_user_id = $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [req.user._id]
    )
  ]);

  const recentPerformance = performanceResult.rows.map((row) => mapPerformanceWithSubject(row));
  const recentAttendance = attendanceResult.rows.map((row) => mapAttendanceRow(row));
  const notifications = notificationsResult.rows.map((row) => mapNotificationRow(row));

  return res.json({
    student,
    metrics: {
      averageMarks: insightData.averageMarks,
      attendancePercentage: insightData.attendancePercentage,
      riskLevel: insightData.riskLevel
    },
    trendSeries: insightData.trendSeries,
    insights: insightData.insights,
    recentPerformance,
    recentAttendance,
    notifications
  });
};

export const listStudentPerformance = async (req, res) => {
  const student = await resolveStudentForUser(req.user);
  if (!student) {
    return res.status(404).json({ message: "Student profile not linked for this account" });
  }

  const { page, limit, skip } = getPagination(req.query);

  const [itemsResult, totalResult] = await Promise.all([
    query(
      `SELECT
         pr.*,
         subj.name AS subject_name,
         subj.code AS subject_code
       FROM performance_records pr
       INNER JOIN subjects subj ON subj.id = pr.subject_id
       WHERE pr.school_id = $1
         AND pr.student_id = $2
       ORDER BY pr.exam_date DESC
       OFFSET $3
       LIMIT $4`,
      [req.user.schoolId, student._id, skip, limit]
    ),
    query(
      `SELECT COUNT(*)::int AS count
       FROM performance_records
       WHERE school_id = $1
         AND student_id = $2`,
      [req.user.schoolId, student._id]
    )
  ]);

  const items = itemsResult.rows.map((row) => mapPerformanceWithSubject(row));
  const total = Number(totalResult.rows[0]?.count || 0);

  return res.json({
    items,
    meta: buildPageMeta(page, limit, total)
  });
};

export const listStudentAttendance = async (req, res) => {
  const student = await resolveStudentForUser(req.user);
  if (!student) {
    return res.status(404).json({ message: "Student profile not linked for this account" });
  }

  const { page, limit, skip } = getPagination(req.query);

  const [itemsResult, totalResult] = await Promise.all([
    query(
      `SELECT *
       FROM attendance_records
       WHERE school_id = $1
         AND student_id = $2
       ORDER BY date DESC
       OFFSET $3
       LIMIT $4`,
      [req.user.schoolId, student._id, skip, limit]
    ),
    query(
      `SELECT COUNT(*)::int AS count
       FROM attendance_records
       WHERE school_id = $1
         AND student_id = $2`,
      [req.user.schoolId, student._id]
    )
  ]);

  const items = itemsResult.rows.map((row) => mapAttendanceRow(row));
  const total = Number(totalResult.rows[0]?.count || 0);

  return res.json({
    items,
    meta: buildPageMeta(page, limit, total)
  });
};

export const studentTimetable = async (req, res) => {
  const student = await resolveStudentForUser(req.user);
  if (!student) {
    return res.status(404).json({ message: "Student profile not linked for this account" });
  }

  const className = toClassName(student.grade, student.section);

  const slotsResult = await query(
    `SELECT
       ts.*,
       u.full_name AS teacher_full_name,
       u.email AS teacher_email
     FROM timetable_slots ts
     LEFT JOIN users u ON u.id = ts.teacher_user_id
     WHERE ts.school_id = $1
       AND ts.class_name = $2`,
    [req.user.schoolId, className]
  );

  const weeklyTimetable = slotsResult.rows
    .map((row) => ({
      id: row.id,
      className: row.class_name,
      dayOfWeek: row.day_of_week,
      periodNo: row.period_no,
      startTime: row.start_time,
      endTime: row.end_time,
      subjectName: row.subject_name,
      roomLabel: row.room_label,
      teacherName: row.teacher_full_name || "Teacher",
      teacherEmail: row.teacher_email || ""
    }))
    .sort((a, b) => {
      if (dayOrder[a.dayOfWeek] !== dayOrder[b.dayOfWeek]) return dayOrder[a.dayOfWeek] - dayOrder[b.dayOfWeek];
      return a.periodNo - b.periodNo;
    });

  return res.json({ className, weeklyTimetable });
};

export const downloadStudentReport = async (req, res) => {
  const student = await resolveStudentForUser(req.user);
  if (!student) {
    return res.status(404).json({ message: "Student profile not linked for this account" });
  }

  const schoolResult = await query(
    `SELECT *
     FROM schools
     WHERE id = $1
     LIMIT 1`,
    [req.user.schoolId]
  );

  const school = schoolResult.rows.length ? mapSchoolRow(schoolResult.rows[0]) : null;

  if (!school) {
    return res.status(404).json({ message: "School not found for this student" });
  }

  const [performanceResult, insightsData] = await Promise.all([
    query(
      `SELECT
         pr.*,
         subj.name AS subject_name,
         subj.code AS subject_code
       FROM performance_records pr
       INNER JOIN subjects subj ON subj.id = pr.subject_id
       WHERE pr.school_id = $1
         AND pr.student_id = $2
       ORDER BY pr.exam_date ASC`,
      [req.user.schoolId, student._id]
    ),
    evaluateStudentInsights({ schoolId: req.user.schoolId, studentId: student._id, notify: false })
  ]);

  const performanceRecords = performanceResult.rows.map((row) => mapPerformanceWithSubject(row));

  const pdfBuffer = await buildStudentReportPdf({
    school,
    student,
    performanceRecords,
    attendancePercentage: insightsData.attendancePercentage,
    riskLevel: insightsData.riskLevel,
    insights: insightsData.insights
  });

  const filename = `report-${student.admissionNumber}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  return res.send(pdfBuffer);
};

