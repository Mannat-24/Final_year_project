import { PerformanceRecord } from "../models/PerformanceRecord.js";
import { Student } from "../models/Student.js";
import { buildAiChatReply } from "../services/chatService.js";
import { evaluateStudentInsights } from "../services/insightService.js";

const examRank = {
  "UT-1": 1,
  "UT1": 1,
  "UT-2": 2,
  "UT2": 2,
  "TERM-1": 3,
  "TERM1": 3,
  "TERM-2": 4,
  "TERM2": 4,
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
    return Student.findOne({ schoolId, admissionNumber: explicitCode }).lean();
  }

  const text = String(message || "");
  const codeFromMessage = text.match(/[A-Za-z]{1,10}-?\d{2,10}/)?.[0];
  if (codeFromMessage) {
    const student = await Student.findOne({ schoolId, admissionNumber: codeFromMessage }).lean();
    if (student) return student;
  }

  const count = await Student.countDocuments({ schoolId });
  if (count === 1) {
    return Student.findOne({ schoolId }).lean();
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

    targetStudent = await Student.findOne({
      _id: req.user.studentProfileId,
      schoolId: req.user.schoolId
    }).lean();
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
    const records = await PerformanceRecord.find({
      schoolId: req.user.schoolId,
      studentId: targetStudent._id
    })
      .populate("subjectId", "name")
      .sort({ examDate: -1 })
      .limit(80)
      .lean();

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
