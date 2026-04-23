import { AttendanceRecord } from "../models/AttendanceRecord.js";
import { Notification } from "../models/Notification.js";
import { PerformanceRecord } from "../models/PerformanceRecord.js";
import { School } from "../models/School.js";
import { Student } from "../models/Student.js";
import { TimeTableSlot } from "../models/TimeTableSlot.js";
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

const resolveStudentForUser = async (user) => {
  if (!user.studentProfileId) return null;
  return Student.findOne({ _id: user.studentProfileId, schoolId: user.schoolId }).lean();
};

export const studentDashboard = async (req, res) => {
  const student = await resolveStudentForUser(req.user);
  if (!student) {
    return res.status(404).json({ message: "Student profile not linked for this account" });
  }

  const [insightData, recentPerformance, recentAttendance, notifications] = await Promise.all([
    evaluateStudentInsights({ schoolId: req.user.schoolId, studentId: student._id, notify: false }),
    PerformanceRecord.find({ schoolId: req.user.schoolId, studentId: student._id })
      .populate("subjectId", "name code")
      .sort({ examDate: -1 })
      .limit(12)
      .lean(),
    AttendanceRecord.find({ schoolId: req.user.schoolId, studentId: student._id })
      .sort({ date: -1 })
      .limit(20)
      .lean(),
    Notification.find({ recipientUserId: req.user._id }).sort({ createdAt: -1 }).limit(10).lean()
  ]);

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

  const [items, total] = await Promise.all([
    PerformanceRecord.find({ schoolId: req.user.schoolId, studentId: student._id })
      .populate("subjectId", "name code")
      .sort({ examDate: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    PerformanceRecord.countDocuments({ schoolId: req.user.schoolId, studentId: student._id })
  ]);

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

  const [items, total] = await Promise.all([
    AttendanceRecord.find({ schoolId: req.user.schoolId, studentId: student._id })
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    AttendanceRecord.countDocuments({ schoolId: req.user.schoolId, studentId: student._id })
  ]);

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

  const slots = await TimeTableSlot.find({ schoolId: req.user.schoolId, className })
    .populate("teacherUserId", "fullName email")
    .lean();

  const weeklyTimetable = slots
    .map((slot) => ({
      id: slot._id,
      className: slot.className,
      dayOfWeek: slot.dayOfWeek,
      periodNo: slot.periodNo,
      startTime: slot.startTime,
      endTime: slot.endTime,
      subjectName: slot.subjectName,
      roomLabel: slot.roomLabel,
      teacherName: slot.teacherUserId?.fullName || "Teacher",
      teacherEmail: slot.teacherUserId?.email || ""
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

  const school = await School.findById(req.user.schoolId).lean();

  const [performanceRecords, insightsData] = await Promise.all([
    PerformanceRecord.find({ schoolId: req.user.schoolId, studentId: student._id })
      .populate("subjectId", "name code")
      .sort({ examDate: 1 })
      .lean(),
    evaluateStudentInsights({ schoolId: req.user.schoolId, studentId: student._id, notify: false })
  ]);

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
