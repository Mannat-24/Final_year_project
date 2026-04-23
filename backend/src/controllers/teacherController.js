import { emitSchoolEvent, emitStudentEvent } from "../config/socket.js";
import { AttendanceRecord } from "../models/AttendanceRecord.js";
import { PerformanceRecord } from "../models/PerformanceRecord.js";
import { Student } from "../models/Student.js";
import { Subject } from "../models/Subject.js";
import { TimeTableSlot } from "../models/TimeTableSlot.js";
import { User } from "../models/User.js";
import { evaluateStudentInsights } from "../services/insightService.js";
import { createNotifications } from "../services/notificationService.js";
import { buildPageMeta, getPagination } from "../utils/pagination.js";

const dayOrder = {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6
};

const normalizeDate = (input) => {
  const date = new Date(input);
  date.setHours(0, 0, 0, 0);
  return date;
};

const startOfWeek = (inputDate = new Date()) => {
  const date = new Date(inputDate);
  const day = date.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diffToMonday);
  date.setHours(0, 0, 0, 0);
  return date;
};

const endOfDay = (inputDate = new Date()) => {
  const date = new Date(inputDate);
  date.setHours(23, 59, 59, 999);
  return date;
};

const getElapsedSchoolDaysInWeek = (today = new Date()) => {
  const weekStart = startOfWeek(today);
  const pointer = new Date(weekStart);
  const end = endOfDay(today);

  let count = 0;

  while (pointer <= end) {
    const day = pointer.getDay();
    if (day >= 1 && day <= 6) {
      count += 1;
    }
    pointer.setDate(pointer.getDate() + 1);
  }

  return count;
};

const toClassName = (grade, section) => `Class ${String(grade).trim()}-${String(section || "A").trim()}`;

const ensureSchoolEntities = async (schoolId, studentId, subjectId) => {
  const [student, subject] = await Promise.all([
    Student.findOne({ _id: studentId, schoolId }).lean(),
    Subject.findOne({ _id: subjectId, schoolId }).lean()
  ]);

  if (!student) {
    return { error: { status: 404, message: "Student not found in your school" } };
  }

  if (!subject) {
    return { error: { status: 404, message: "Subject not found in your school" } };
  }

  return { student, subject };
};

export const upsertPerformanceRecord = async (req, res) => {
  const { recordId, studentId, subjectId, examType, marksObtained, maxMarks, examDate, remark } = req.body;

  const schoolId = req.user.schoolId;
  const { student, subject, error } = await ensureSchoolEntities(schoolId, studentId, subjectId);
  if (error) {
    return res.status(error.status).json({ message: error.message });
  }

  const payload = {
    schoolId,
    studentId,
    subjectId,
    teacherUserId: req.user._id,
    examType,
    marksObtained,
    maxMarks,
    examDate: new Date(examDate),
    remark: remark || ""
  };

  let record;

  if (recordId) {
    record = await PerformanceRecord.findOneAndUpdate(
      { _id: recordId, schoolId },
      payload,
      { new: true }
    ).populate("subjectId", "name code");

    if (!record) {
      return res.status(404).json({ message: "Performance record not found" });
    }
  } else {
    record = await PerformanceRecord.create(payload);
    record = await record.populate("subjectId", "name code");
  }

  const insightsResult = await evaluateStudentInsights({
    schoolId,
    studentId,
    senderUserId: req.user._id
  });

  await PerformanceRecord.findByIdAndUpdate(record._id, { riskLevel: insightsResult.riskLevel });

  const scorePercent = (Number(marksObtained) / Number(maxMarks)) * 100;
  if (scorePercent < 40) {
    const studentUser = await User.findOne({
      schoolId,
      role: "student",
      studentProfileId: studentId
    }).select("_id");

    const recipients = [...(student.parentUserIds || []), ...(studentUser ? [studentUser._id] : [])];

    await createNotifications({
      schoolId,
      recipientUserIds: recipients,
      senderUserId: req.user._id,
      studentId,
      type: "performance",
      title: `Low score alert: ${student.fullName}`,
      message: `${subject.name} ${examType} score is ${Number(scorePercent.toFixed(2))}%`,
      metadata: {
        marksObtained,
        maxMarks,
        examType
      }
    });
  }

  const realtimePayload = {
    studentId,
    schoolId,
    record,
    insights: insightsResult.insights,
    riskLevel: insightsResult.riskLevel,
    updatedAt: new Date().toISOString()
  };

  emitSchoolEvent(String(schoolId), "performance:updated", realtimePayload);
  emitStudentEvent(String(studentId), "performance:updated", realtimePayload);

  return res.status(recordId ? 200 : 201).json({
    record,
    insights: insightsResult.insights,
    riskLevel: insightsResult.riskLevel
  });
};

export const upsertAttendanceRecord = async (req, res) => {
  const { studentId, date, status, remark } = req.body;
  const schoolId = req.user.schoolId;

  const student = await Student.findOne({ _id: studentId, schoolId }).lean();
  if (!student) {
    return res.status(404).json({ message: "Student not found in your school" });
  }

  const normalizedDate = normalizeDate(date);

  const record = await AttendanceRecord.findOneAndUpdate(
    { schoolId, studentId, date: normalizedDate },
    {
      schoolId,
      studentId,
      teacherUserId: req.user._id,
      date: normalizedDate,
      status,
      remark: remark || ""
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const insightsResult = await evaluateStudentInsights({
    schoolId,
    studentId,
    senderUserId: req.user._id
  });

  if (status === "Absent") {
    await createNotifications({
      schoolId,
      recipientUserIds: student.parentUserIds || [],
      senderUserId: req.user._id,
      studentId,
      type: "attendance",
      title: `Attendance alert: ${student.fullName}`,
      message: `Student was marked absent on ${normalizedDate.toLocaleDateString("en-IN")}`,
      metadata: {
        date: normalizedDate,
        status
      }
    });
  }

  const realtimePayload = {
    studentId,
    schoolId,
    record,
    insights: insightsResult.insights,
    riskLevel: insightsResult.riskLevel,
    updatedAt: new Date().toISOString()
  };

  emitSchoolEvent(String(schoolId), "attendance:updated", realtimePayload);
  emitStudentEvent(String(studentId), "attendance:updated", realtimePayload);

  return res.json({
    record,
    insights: insightsResult.insights,
    riskLevel: insightsResult.riskLevel
  });
};

export const listPerformanceRecords = async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = { schoolId: req.user.schoolId };

  if (req.query.studentId) filter.studentId = req.query.studentId;
  if (req.query.subjectId) filter.subjectId = req.query.subjectId;

  const [items, total] = await Promise.all([
    PerformanceRecord.find(filter)
      .populate("studentId", "fullName admissionNumber grade section")
      .populate("subjectId", "name code")
      .sort({ examDate: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    PerformanceRecord.countDocuments(filter)
  ]);

  return res.json({
    items,
    meta: buildPageMeta(page, limit, total)
  });
};

export const listAttendanceRecords = async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = { schoolId: req.user.schoolId };

  if (req.query.studentId) filter.studentId = req.query.studentId;

  const [items, total] = await Promise.all([
    AttendanceRecord.find(filter)
      .populate("studentId", "fullName admissionNumber grade section")
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    AttendanceRecord.countDocuments(filter)
  ]);

  return res.json({
    items,
    meta: buildPageMeta(page, limit, total)
  });
};

export const teacherDashboard = async (req, res) => {
  const schoolId = req.user.schoolId;
  const now = new Date();
  const weekStart = startOfWeek(now);
  const weekEnd = endOfDay(now);
  const elapsedSchoolDays = getElapsedSchoolDaysInWeek(now);

  const [recentPerformance, recentAttendance, totalStudents, weekAttendanceCount] = await Promise.all([
    PerformanceRecord.find({ schoolId, teacherUserId: req.user._id })
      .populate("studentId", "fullName")
      .populate("subjectId", "name")
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
    AttendanceRecord.find({ schoolId, teacherUserId: req.user._id })
      .populate("studentId", "fullName")
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
    Student.countDocuments({ schoolId }),
    AttendanceRecord.countDocuments({
      schoolId,
      date: {
        $gte: weekStart,
        $lte: weekEnd
      }
    })
  ]);

  const expectedWeekAttendance = totalStudents * elapsedSchoolDays;
  const pendingAttendanceThisWeek = Math.max(0, expectedWeekAttendance - weekAttendanceCount);

  return res.json({
    totals: {
      totalStudents,
      performanceUpdates: recentPerformance.length,
      attendanceUpdates: recentAttendance.length,
      pendingAttendanceThisWeek
    },
    recentPerformance,
    recentAttendance
  });
};

export const teacherReferenceData = async (req, res) => {
  const [students, subjects] = await Promise.all([
    Student.find({ schoolId: req.user.schoolId })
      .select("_id fullName admissionNumber grade section")
      .sort({ fullName: 1 })
      .lean(),
    Subject.find({ schoolId: req.user.schoolId })
      .select("_id name code")
      .sort({ name: 1 })
      .lean()
  ]);

  const classes = [
    ...new Set(students.map((student) => toClassName(student.grade, student.section)))
  ]
    .sort((a, b) => a.localeCompare(b))
    .map((className) => ({ className }));

  return res.json({ students, subjects, classes });
};

export const teacherTimetable = async (req, res) => {
  const schoolId = req.user.schoolId;

  const students = await Student.find({ schoolId }).select("grade section").lean();
  const classes = [...new Set(students.map((student) => toClassName(student.grade, student.section)))]
    .sort((a, b) => a.localeCompare(b))
    .map((className) => ({ className }));

  const selectedClass = String(req.query.className || classes[0]?.className || "").trim();

  if (!selectedClass) {
    return res.json({ classes, className: "", slots: [] });
  }

  const slots = await TimeTableSlot.find({ schoolId, className: selectedClass })
    .populate("teacherUserId", "fullName email")
    .lean();

  const mappedSlots = slots
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

  return res.json({ classes, className: selectedClass, slots: mappedSlots });
};

export const upsertTeacherTimetableSlot = async (req, res) => {
  const { className, dayOfWeek, periodNo, startTime, endTime, subjectName, roomLabel } = req.body;
  const schoolId = req.user.schoolId;

  const slot = await TimeTableSlot.findOneAndUpdate(
    { schoolId, className: String(className).trim(), dayOfWeek, periodNo: Number(periodNo) },
    {
      schoolId,
      className: String(className).trim(),
      dayOfWeek,
      periodNo: Number(periodNo),
      startTime: String(startTime).trim(),
      endTime: String(endTime).trim(),
      subjectName: String(subjectName).trim(),
      roomLabel: String(roomLabel || "").trim(),
      teacherUserId: req.user._id
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  emitSchoolEvent(String(schoolId), "timetable:updated", {
    className: slot.className,
    dayOfWeek: slot.dayOfWeek,
    periodNo: slot.periodNo,
    updatedAt: new Date().toISOString()
  });

  return res.status(201).json({
    slot: {
      id: slot._id,
      className: slot.className,
      dayOfWeek: slot.dayOfWeek,
      periodNo: slot.periodNo,
      startTime: slot.startTime,
      endTime: slot.endTime,
      subjectName: slot.subjectName,
      roomLabel: slot.roomLabel
    }
  });
};

export const deleteTeacherTimetableSlot = async (req, res) => {
  const { className, dayOfWeek, periodNo } = req.body;
  const schoolId = req.user.schoolId;

  const deleted = await TimeTableSlot.findOneAndDelete({
    schoolId,
    className: String(className).trim(),
    dayOfWeek,
    periodNo: Number(periodNo)
  }).lean();

  if (!deleted) {
    return res.status(404).json({ message: "Timetable slot not found" });
  }

  emitSchoolEvent(String(schoolId), "timetable:updated", {
    className: deleted.className,
    dayOfWeek: deleted.dayOfWeek,
    periodNo: deleted.periodNo,
    removed: true,
    updatedAt: new Date().toISOString()
  });

  return res.json({ message: "Timetable slot removed" });
};
