import { query } from "../config/db.js";

const toNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

export const getSchoolAnalytics = async (schoolId) => {
  const [subjectRows, attendanceRows, trendRows, userRows, classRows] = await Promise.all([
    query(
      `SELECT
         pr.subject_id AS subject_id,
         subj.name AS subject_name,
         ROUND(AVG((pr.marks_obtained / pr.max_marks) * 100), 2) AS average_marks,
         COUNT(*)::int AS record_count
       FROM performance_records pr
       INNER JOIN subjects subj ON subj.id = pr.subject_id
       WHERE pr.school_id = $1
       GROUP BY pr.subject_id, subj.name
       ORDER BY average_marks DESC`,
      [schoolId]
    ),
    query(
      `SELECT status, COUNT(*)::int AS count
       FROM attendance_records
       WHERE school_id = $1
       GROUP BY status`,
      [schoolId]
    ),
    query(
      `SELECT
         TO_CHAR(pr.exam_date, 'YYYY-MM') AS month,
         ROUND(AVG((pr.marks_obtained / pr.max_marks) * 100), 2) AS avg_score
       FROM performance_records pr
       WHERE pr.school_id = $1
       GROUP BY month
       ORDER BY month`,
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
      `SELECT
         st.grade,
         st.section,
         CONCAT('Class ', st.grade, '-', st.section) AS class_name,
         COUNT(*)::int AS total_records,
         SUM(CASE WHEN ar.status IN ('Present', 'Late') THEN 1 ELSE 0 END)::int AS present_like,
         SUM(CASE WHEN ar.status = 'Absent' THEN 1 ELSE 0 END)::int AS absent,
         ROUND((SUM(CASE WHEN ar.status IN ('Present', 'Late') THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0)) * 100, 2) AS attendance_percentage
       FROM attendance_records ar
       INNER JOIN students st ON st.id = ar.student_id
       WHERE ar.school_id = $1
       GROUP BY st.grade, st.section
       ORDER BY st.grade, st.section`,
      [schoolId]
    )
  ]);

  const subjectAverages = subjectRows.rows.map((row) => ({
    subjectId: row.subject_id,
    subjectName: row.subject_name,
    averageMarks: toNumber(row.average_marks),
    recordCount: toNumber(row.record_count)
  }));

  const attendanceSummary = attendanceRows.rows.map((row) => ({
    _id: row.status,
    count: toNumber(row.count)
  }));

  const performanceTrend = trendRows.rows.map((row) => ({
    month: row.month,
    avgScore: toNumber(row.avg_score)
  }));

  const userBreakdown = userRows.rows.map((row) => ({
    role: row.role,
    count: toNumber(row.count)
  }));

  const classAttendance = classRows.rows.map((row) => ({
    grade: row.grade,
    section: row.section,
    className: row.class_name,
    totalRecords: toNumber(row.total_records),
    presentLike: toNumber(row.present_like),
    absent: toNumber(row.absent),
    attendancePercentage: toNumber(row.attendance_percentage)
  }));

  const totalAttendance = attendanceSummary.reduce((sum, entry) => sum + entry.count, 0);
  const presentLike = attendanceSummary
    .filter((entry) => ["Present", "Late"].includes(entry._id))
    .reduce((sum, entry) => sum + entry.count, 0);

  return {
    subjectAverages,
    attendancePercentage: totalAttendance
      ? Number(((presentLike / totalAttendance) * 100).toFixed(2))
      : 0,
    attendanceSummary,
    performanceTrend,
    userBreakdown,
    classAttendance
  };
};
