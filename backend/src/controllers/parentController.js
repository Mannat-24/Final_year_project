import { AttendanceRecord } from "../models/AttendanceRecord.js";
import { Notification } from "../models/Notification.js";
import { PerformanceRecord } from "../models/PerformanceRecord.js";
import { School } from "../models/School.js";
import { Student } from "../models/Student.js";
import { evaluateStudentInsights } from "../services/insightService.js";
import { buildStudentReportPdf } from "../services/reportService.js";

const getParentChildren = async (user) => {
  if (user.childStudentIds?.length) {
    return Student.find({ _id: { $in: user.childStudentIds }, schoolId: user.schoolId }).lean();
  }

  return Student.find({ schoolId: user.schoolId, parentUserIds: user._id }).lean();
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

  const notifications = await Notification.find({ recipientUserId: req.user._id })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

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

  const [insights, performance, attendance] = await Promise.all([
    evaluateStudentInsights({ schoolId: req.user.schoolId, studentId: child._id, notify: false }),
    PerformanceRecord.find({ schoolId: req.user.schoolId, studentId: child._id })
      .populate("subjectId", "name code")
      .sort({ examDate: -1 })
      .limit(30)
      .lean(),
    AttendanceRecord.find({ schoolId: req.user.schoolId, studentId: child._id })
      .sort({ date: -1 })
      .limit(30)
      .lean()
  ]);

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

  const school = await School.findById(req.user.schoolId).lean();
  const [performanceRecords, insightsData] = await Promise.all([
    PerformanceRecord.find({ schoolId: req.user.schoolId, studentId: child._id })
      .populate("subjectId", "name code")
      .sort({ examDate: 1 })
      .lean(),
    evaluateStudentInsights({ schoolId: req.user.schoolId, studentId: child._id, notify: false })
  ]);

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