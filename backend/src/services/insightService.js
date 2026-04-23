import { query } from "../config/db.js";
import { mapStudentRow } from "../db/mappers.js";
import { createNotifications } from "./notificationService.js";
import { predictRiskLevel } from "./mlService.js";

const percentage = (obtained, max) => {
  if (!max) return 0;
  return Math.max(0, Math.min(100, (Number(obtained) / Number(max)) * 100));
};

export const getAttendancePercentage = async (schoolId, studentId) => {
  const [totalResult, presentOrLateResult] = await Promise.all([
    query(
      `SELECT COUNT(*)::int AS count
       FROM attendance_records
       WHERE school_id = $1
         AND student_id = $2`,
      [schoolId, studentId]
    ),
    query(
      `SELECT COUNT(*)::int AS count
       FROM attendance_records
       WHERE school_id = $1
         AND student_id = $2
         AND status IN ('Present', 'Late')`,
      [schoolId, studentId]
    )
  ]);

  const total = Number(totalResult.rows[0]?.count || 0);
  const presentOrLate = Number(presentOrLateResult.rows[0]?.count || 0);

  if (!total) return 0;
  return Number(((presentOrLate / total) * 100).toFixed(2));
};

export const getAverageMarksPercentage = async (schoolId, studentId) => {
  const { rows } = await query(
    `SELECT marks_obtained, max_marks
     FROM performance_records
     WHERE school_id = $1
       AND student_id = $2`,
    [schoolId, studentId]
  );

  if (!rows.length) return 0;

  const totalPct = rows.reduce(
    (sum, item) => sum + percentage(Number(item.marks_obtained), Number(item.max_marks)),
    0
  );

  return Number((totalPct / rows.length).toFixed(2));
};

const buildDeclineInsights = (records) => {
  const grouped = new Map();

  records.forEach((record) => {
    const subjectKey = String(record.subjectId?._id || record.subjectId);
    const entry = grouped.get(subjectKey) || {
      subjectName: record.subjectId?.name || "Subject",
      percentages: []
    };

    entry.percentages.push(percentage(record.marksObtained, record.maxMarks));
    grouped.set(subjectKey, entry);
  });

  const insights = [];

  grouped.forEach((entry) => {
    if (entry.percentages.length < 4) return;

    const recent = entry.percentages.slice(0, 2);
    const previous = entry.percentages.slice(2, 4);

    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const previousAvg = previous.reduce((a, b) => a + b, 0) / previous.length;

    if (recentAvg + 8 < previousAvg) {
      insights.push(`Performance declining in ${entry.subjectName}`);
    }
  });

  return insights;
};

export const evaluateStudentInsights = async ({
  schoolId,
  studentId,
  senderUserId,
  notify = true
}) => {
  const studentResult = await query(
    `SELECT *
     FROM students
     WHERE id = $1
       AND school_id = $2
     LIMIT 1`,
    [studentId, schoolId]
  );

  if (!studentResult.rows.length) {
    return {
      insights: [],
      riskLevel: "Low",
      attendancePercentage: 0,
      averageMarks: 0,
      trendSeries: []
    };
  }

  const student = mapStudentRow(studentResult.rows[0]);

  const performanceResult = await query(
    `SELECT
       pr.*,
       subj.name AS subject_name
     FROM performance_records pr
     INNER JOIN subjects subj ON subj.id = pr.subject_id
     WHERE pr.school_id = $1
       AND pr.student_id = $2
     ORDER BY pr.exam_date DESC
     LIMIT 40`,
    [schoolId, studentId]
  );

  const performanceRecords = performanceResult.rows.map((row) => ({
    _id: row.id,
    schoolId: row.school_id,
    studentId: row.student_id,
    subjectId: {
      _id: row.subject_id,
      name: row.subject_name
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
  }));

  const attendancePercentage = await getAttendancePercentage(schoolId, studentId);

  const marksSeries = performanceRecords.map((record) => percentage(record.marksObtained, record.maxMarks));
  const averageMarks = marksSeries.length
    ? Number((marksSeries.reduce((acc, value) => acc + value, 0) / marksSeries.length).toFixed(2))
    : 0;

  const pastSlice = marksSeries.slice(1, 6);
  const pastPerformance = pastSlice.length
    ? Number((pastSlice.reduce((acc, value) => acc + value, 0) / pastSlice.length).toFixed(2))
    : averageMarks;

  const mlPrediction = await predictRiskLevel({
    marks: averageMarks,
    attendance: attendancePercentage,
    pastPerformance
  });

  const insights = [];
  if (attendancePercentage < 75) {
    insights.push("Low attendance detected");
  }

  insights.push(...buildDeclineInsights(performanceRecords));

  if (averageMarks < 50) {
    insights.push("Overall academic performance needs attention");
  }

  if (mlPrediction.riskLevel === "High") {
    insights.push("High risk level detected by predictive model");
  }

  const uniqueInsights = [...new Set(insights)];

  if (notify && uniqueInsights.length) {
    const recipients = [...(student.parentUserIds || []), ...(student.teacherUserIds || [])];

    await Promise.all(
      uniqueInsights.map((insight) =>
        createNotifications({
          schoolId,
          recipientUserIds: recipients,
          senderUserId,
          studentId,
          type: insight.toLowerCase().includes("attendance") ? "attendance" : "performance",
          title: `Automated insight for ${student.fullName}`,
          message: insight,
          metadata: {
            attendancePercentage,
            averageMarks,
            riskLevel: mlPrediction.riskLevel
          }
        })
      )
    );
  }

  const trendSeries = performanceRecords
    .slice()
    .reverse()
    .map((record) => ({
      date: record.examDate,
      examType: record.examType,
      score: Number(percentage(record.marksObtained, record.maxMarks).toFixed(2))
    }));

  return {
    insights: uniqueInsights,
    riskLevel: mlPrediction.riskLevel,
    attendancePercentage,
    averageMarks,
    trendSeries
  };
};
