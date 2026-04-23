import { AttendanceRecord } from "../models/AttendanceRecord.js";
import { PerformanceRecord } from "../models/PerformanceRecord.js";
import { Student } from "../models/Student.js";
import { createNotifications } from "./notificationService.js";
import { predictRiskLevel } from "./mlService.js";

const percentage = (obtained, max) => {
  if (!max) return 0;
  return Math.max(0, Math.min(100, (Number(obtained) / Number(max)) * 100));
};

export const getAttendancePercentage = async (schoolId, studentId) => {
  const [total, presentOrLate] = await Promise.all([
    AttendanceRecord.countDocuments({ schoolId, studentId }),
    AttendanceRecord.countDocuments({
      schoolId,
      studentId,
      status: { $in: ["Present", "Late"] }
    })
  ]);

  if (!total) return 0;
  return Number(((presentOrLate / total) * 100).toFixed(2));
};

export const getAverageMarksPercentage = async (schoolId, studentId) => {
  const records = await PerformanceRecord.find({ schoolId, studentId })
    .select("marksObtained maxMarks")
    .lean();

  if (!records.length) return 0;
  const totalPct = records.reduce((sum, item) => sum + percentage(item.marksObtained, item.maxMarks), 0);
  return Number((totalPct / records.length).toFixed(2));
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
  const student = await Student.findOne({ _id: studentId, schoolId }).lean();
  if (!student) {
    return {
      insights: [],
      riskLevel: "Low",
      attendancePercentage: 0,
      averageMarks: 0,
      trendSeries: []
    };
  }

  const performanceRecords = await PerformanceRecord.find({ schoolId, studentId })
    .populate("subjectId", "name")
    .sort({ examDate: -1 })
    .limit(40)
    .lean();

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