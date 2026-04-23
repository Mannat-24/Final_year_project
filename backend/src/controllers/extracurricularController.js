import { emitSchoolEvent, emitStudentEvent } from "../config/socket.js";
import { ExtracurricularRecord } from "../models/ExtracurricularRecord.js";
import { Student } from "../models/Student.js";
import { buildPageMeta, getPagination } from "../utils/pagination.js";

export const listExtracurricularRecords = async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = { schoolId: req.user.schoolId };

  if (req.query.studentId) {
    filter.studentId = req.query.studentId;
  }

  const [items, total] = await Promise.all([
    ExtracurricularRecord.find(filter)
      .populate("studentId", "fullName admissionNumber grade section")
      .populate("teacherUserId", "fullName email")
      .sort({ participationDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    ExtracurricularRecord.countDocuments(filter)
  ]);

  return res.json({
    items,
    meta: buildPageMeta(page, limit, total)
  });
};

export const upsertExtracurricularRecord = async (req, res) => {
  const {
    recordId,
    studentId,
    activityType,
    activityName,
    level,
    participationDate,
    remarks
  } = req.body;

  const schoolId = req.user.schoolId;

  const student = await Student.findOne({ _id: studentId, schoolId }).lean();
  if (!student) {
    return res.status(404).json({ message: "Student not found in your school" });
  }

  const payload = {
    schoolId,
    studentId,
    teacherUserId: req.user._id,
    activityType,
    activityName,
    level: level || "School",
    participationDate: new Date(participationDate),
    remarks: remarks || ""
  };

  let record;

  if (recordId) {
    record = await ExtracurricularRecord.findOneAndUpdate(
      { _id: recordId, schoolId },
      payload,
      { new: true }
    )
      .populate("studentId", "fullName admissionNumber grade section")
      .populate("teacherUserId", "fullName email");

    if (!record) {
      return res.status(404).json({ message: "Extracurricular record not found" });
    }
  } else {
    record = await ExtracurricularRecord.create(payload);
    record = await record
      .populate("studentId", "fullName admissionNumber grade section")
      .populate("teacherUserId", "fullName email");
  }

  const realtimePayload = {
    schoolId,
    studentId,
    record,
    updatedAt: new Date().toISOString()
  };

  emitSchoolEvent(String(schoolId), "extracurricular:updated", realtimePayload);
  emitStudentEvent(String(studentId), "extracurricular:updated", realtimePayload);

  return res.status(recordId ? 200 : 201).json({ record });
};
