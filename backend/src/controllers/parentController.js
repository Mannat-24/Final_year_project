import { query } from "../config/db.js";
import { mapAttendanceRow, mapNotificationRow, mapSchoolRow, mapStudentRow } from "../db/mappers.js";
import { evaluateStudentInsights } from "../services/insightService.js";
import { buildStudentReportPdf } from "../services/reportService.js";

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

const getParentChildren = async (user) => {
  if (user.childStudentIds?.length) {
    const { rows } = await query(
      `SELECT *
       FROM students
       WHERE id = ANY($1::uuid[])
         AND school_id = $2`,
      [user.childStudentIds, user.schoolId]
    );

    return rows.map((row) => mapStudentRow(row));
  }

  const { rows } = await query(
    `SELECT *
     FROM students
     WHERE school_id = $1
       AND parent_user_ids @> ARRAY[$2]::uuid[]`,
    [user.schoolId, user._id]
  );

  return rows.map((row) => mapStudentRow(row));
};

export const parentDashboard = async (req, res) => {
  const children = await getParentChildren(req.user);

  const childSummaries = await Promise.all(
    children.map(async (child) => {
      const insights = await evaluateStudentInsights({
        schoolId: req.user.schoolId,
        studentId: child._id,
        notify: false
      });

      return {
        student: child,
        averageMarks: insights.averageMarks,
        attendancePercentage: insights.attendancePercentage,
        riskLevel: insights.riskLevel,
        insights: insights.insights
      };
    })
  );

  const notificationsResult = await query(
    `SELECT *
     FROM notifications
     WHERE recipient_user_id = $1
     ORDER BY created_at DESC
     LIMIT 20`,
    [req.user._id]
  );

  const notifications = notificationsResult.rows.map((row) => mapNotificationRow(row));

  return res.json({
    children: childSummaries,
    notifications
  });
};

export const childProgress = async (req, res) => {
  const children = await getParentChildren(req.user);
  const child = children.find((item) => String(item._id) === String(req.params.studentId));

  if (!child) {
    return res.status(404).json({ message: "Child not found for this parent account" });
  }

  const [insights, performanceResult, attendanceResult] = await Promise.all([
    evaluateStudentInsights({ schoolId: req.user.schoolId, studentId: child._id, notify: false }),
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
       LIMIT 30`,
      [req.user.schoolId, child._id]
    ),
    query(
      `SELECT *
       FROM attendance_records
       WHERE school_id = $1
         AND student_id = $2
       ORDER BY date DESC
       LIMIT 30`,
      [req.user.schoolId, child._id]
    )
  ]);

  const performance = performanceResult.rows.map((row) => mapPerformanceWithSubject(row));
  const attendance = attendanceResult.rows.map((row) => mapAttendanceRow(row));

  return res.json({
    child,
    metrics: {
      averageMarks: insights.averageMarks,
      attendancePercentage: insights.attendancePercentage,
      riskLevel: insights.riskLevel
    },
    insights: insights.insights,
    trendSeries: insights.trendSeries,
    performance,
    attendance
  });
};

export const downloadChildReport = async (req, res) => {
  const children = await getParentChildren(req.user);
  const child = children.find((item) => String(item._id) === String(req.params.studentId));

  if (!child) {
    return res.status(404).json({ message: "Child not found for this parent account" });
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
    return res.status(404).json({ message: "School not found for parent account" });
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
      [req.user.schoolId, child._id]
    ),
    evaluateStudentInsights({ schoolId: req.user.schoolId, studentId: child._id, notify: false })
  ]);

  const performanceRecords = performanceResult.rows.map((row) => mapPerformanceWithSubject(row));

  const pdfBuffer = await buildStudentReportPdf({
    school,
    student: child,
    performanceRecords,
    attendancePercentage: insightsData.attendancePercentage,
    riskLevel: insightsData.riskLevel,
    insights: insightsData.insights
  });

  const filename = `report-${child.admissionNumber}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  return res.send(pdfBuffer);
};

