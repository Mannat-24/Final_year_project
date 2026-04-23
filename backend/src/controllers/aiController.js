import { query } from "../config/db.js";
import { mapStudentRow } from "../db/mappers.js";
import { buildAiChatReply } from "../services/chatService.js";
import { evaluateStudentInsights } from "../services/insightService.js";

const examRank = {
  "UT-1": 1,
  UT1: 1,
  "UT-2": 2,
  UT2: 2,
  "TERM-1": 3,
  TERM1: 3,
  "TERM-2": 4,
  TERM2: 4,
  ANNUAL: 5,
  FINAL: 6
};

const toPercent = (obtained, max) => {
  if (!max) return 0;
  return Number((((Number(obtained) / Number(max)) * 100) || 0).toFixed(2));
};

const stdDeviation = (values) => {
  if (!values.length) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
};

const computeSubjectAverages = (records) => {
  const map = new Map();

  records.forEach((item) => {
    const subjectName = item.subjectId?.name || "Subject";
    const percentage = toPercent(item.marksObtained, item.maxMarks);

    const stats = map.get(subjectName) || { total: 0, count: 0 };
    stats.total += percentage;
    stats.count += 1;
    map.set(subjectName, stats);
  });

  return Array.from(map.entries())
    .map(([subjectName, stats]) => ({
      subjectName,
      averageScore: Number((stats.total / stats.count).toFixed(2))
    }))
    .sort((a, b) => b.averageScore - a.averageScore);
};

const computeYearlyInsights = ({ records, subjectAverages, riskLevel }) => {
  const scoresInOrder = records
    .slice()
    .sort((a, b) => {
      const aRank = examRank[a.examType] || 999;
      const bRank = examRank[b.examType] || 999;
      if (aRank !== bRank) return aRank - bRank;
      return new Date(a.examDate).getTime() - new Date(b.examDate).getTime();
    })
    .map((item) => toPercent(item.marksObtained, item.maxMarks));

  const overallWeightedAverage = scoresInOrder.length
    ? Number((scoresInOrder.reduce((sum, value) => sum + value, 0) / scoresInOrder.length).toFixed(2))
    : 0;

  const yearlyTrend = scoresInOrder.length >= 2
    ? Number((scoresInOrder[scoresInOrder.length - 1] - scoresInOrder[0]).toFixed(2))
    : 0;

  const consistencyIndex = Number(Math.max(0, 100 - stdDeviation(scoresInOrder)).toFixed(2));

  const weakestSubjects = [...subjectAverages]
    .sort((a, b) => a.averageScore - b.averageScore)
    .slice(0, 3)
    .map((item) => item.subjectName);

  const strongestSubjects = [...subjectAverages]
    .sort((a, b) => b.averageScore - a.averageScore)
    .slice(0, 2)
    .map((item) => item.subjectName);

  return {
    summary: {
      overallWeightedAverage,
      yearlyTrend,
      consistencyIndex,
      riskLevel: String(riskLevel || "low").toLowerCase(),
      weakestSubjects,
      strongestSubjects,
      improvingSubjects: yearlyTrend > 0 ? strongestSubjects : []
    },
    subjectReports: []
  };
};

const resolveStudentForTeacher = async ({ schoolId, studentCode, message }) => {
  const explicitCode = String(studentCode || "").trim();
  if (explicitCode) {
    const { rows } = await query(
      `SELECT *
       FROM students
       WHERE school_id = $1
         AND admission_number = $2
       LIMIT 1`,
      [schoolId, explicitCode]
    );

    return rows.length ? mapStudentRow(rows[0]) : null;
  }

  const text = String(message || "");
  const codeFromMessage = text.match(/[A-Za-z]{1,10}-?\d{2,10}/)?.[0];
  if (codeFromMessage) {
    const { rows } = await query(
      `SELECT *
       FROM students
       WHERE school_id = $1
         AND admission_number = $2
       LIMIT 1`,
      [schoolId, codeFromMessage]
    );

    if (rows.length) return mapStudentRow(rows[0]);
  }

  const countResult = await query(
    `SELECT COUNT(*)::int AS count
     FROM students
     WHERE school_id = $1`,
    [schoolId]
  );

  const count = Number(countResult.rows[0]?.count || 0);

  if (count === 1) {
    const { rows } = await query(
      `SELECT *
       FROM students
       WHERE school_id = $1
       LIMIT 1`,
      [schoolId]
    );

    return rows.length ? mapStudentRow(rows[0]) : null;
  }

  return null;
};

export const chatWithAi = async (req, res) => {
  const { message, studentCode } = req.body || {};

  if (!String(message || "").trim()) {
    return res.status(400).json({ message: "message is required" });
  }

  let targetStudent = null;

  if (req.user.role === "student") {
    if (!req.user.studentProfileId) {
      return res.status(400).json({ message: "Student profile not linked" });
    }

    const studentResult = await query(
      `SELECT *
       FROM students
       WHERE id = $1
         AND school_id = $2
       LIMIT 1`,
      [req.user.studentProfileId, req.user.schoolId]
    );

    targetStudent = studentResult.rows.length ? mapStudentRow(studentResult.rows[0]) : null;
  }

  if (req.user.role === "teacher") {
    targetStudent = await resolveStudentForTeacher({
      schoolId: req.user.schoolId,
      studentCode,
      message
    });
  }

  let subjectAverages = [];
  let yearlyInsights = {
    summary: {
      overallWeightedAverage: 0,
      yearlyTrend: 0,
      consistencyIndex: 0,
      riskLevel: "low",
      weakestSubjects: [],
      strongestSubjects: [],
      improvingSubjects: []
    },
    subjectReports: []
  };
  let aiSuggestions = [];

  if (targetStudent) {
    const recordsResult = await query(
      `SELECT
         pr.*,
         subj.name AS subject_name
       FROM performance_records pr
       INNER JOIN subjects subj ON subj.id = pr.subject_id
       WHERE pr.school_id = $1
         AND pr.student_id = $2
       ORDER BY pr.exam_date DESC
       LIMIT 80`,
      [req.user.schoolId, targetStudent._id]
    );

    const records = recordsResult.rows.map((row) => ({
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
      riskLevel: row.risk_level || "Low"
    }));

    const insightData = await evaluateStudentInsights({
      schoolId: req.user.schoolId,
      studentId: targetStudent._id,
      notify: false
    });

    subjectAverages = computeSubjectAverages(records);
    yearlyInsights = computeYearlyInsights({
      records,
      subjectAverages,
      riskLevel: insightData.riskLevel
    });
    aiSuggestions = insightData.insights || [];
  }

  const reply = buildAiChatReply({
    role: req.user.role,
    message,
    subjectAverages,
    yearlyInsights,
    studentCode: targetStudent?.admissionNumber || null
  });

  return res.json({
    reply,
    context: {
      studentId: targetStudent?._id || null,
      studentCode: targetStudent?.admissionNumber || null,
      subjectAverages,
      yearlyInsights,
      aiSuggestions
    }
  });
};
