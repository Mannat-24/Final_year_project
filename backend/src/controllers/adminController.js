import bcrypt from "bcryptjs";
import { School } from "../models/School.js";
import { Student } from "../models/Student.js";
import { Subject } from "../models/Subject.js";
import { User } from "../models/User.js";
import { getSchoolAnalytics } from "../services/analyticsService.js";
import { buildPageMeta, getPagination } from "../utils/pagination.js";

const toPublicUser = (item) => ({
  _id: item._id,
  fullName: item.fullName,
  email: item.email,
  role: item.role,
  schoolId: item.schoolId,
  studentProfileId: item.studentProfileId || null,
  childStudentIds: item.childStudentIds || [],
  isActive: item.isActive
});

export const adminSchoolProfile = async (req, res) => {
  const schoolId = req.user.schoolId;

  const [school, userCounts, studentCount, subjectCount] = await Promise.all([
    School.findById(schoolId).lean(),
    User.aggregate([
      { $match: { schoolId } },
      {
        $group: {
          _id: "$role",
          count: { $sum: 1 }
        }
      }
    ]),
    Student.countDocuments({ schoolId }),
    Subject.countDocuments({ schoolId })
  ]);

  if (!school) {
    return res.status(404).json({ message: "School not found for admin account" });
  }

  const summary = {
    admins: 0,
    teachers: 0,
    students: 0,
    parents: 0
  };

  userCounts.forEach((item) => {
    if (item._id === "admin") summary.admins = item.count;
    if (item._id === "teacher") summary.teachers = item.count;
    if (item._id === "student") summary.students = item.count;
    if (item._id === "parent") summary.parents = item.count;
  });

  return res.json({
    school: {
      _id: school._id,
      name: school.name,
      code: school.code,
      address: school.address,
      contactEmail: school.contactEmail
    },
    summary: {
      ...summary,
      studentProfiles: studentCount,
      subjects: subjectCount,
      totalUsers: summary.admins + summary.teachers + summary.students + summary.parents
    }
  });
};

export const createManagedUser = async (req, res) => {
  const { fullName, email, password, role, studentProfileId, childStudentIds = [] } = req.body;

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return res.status(409).json({ message: "Email already in use" });
  }

  if (studentProfileId) {
    const student = await Student.findOne({ _id: studentProfileId, schoolId: req.user.schoolId });
    if (!student) {
      return res.status(400).json({ message: "studentProfileId does not belong to your school" });
    }
  }

  if (childStudentIds.length) {
    const validCount = await Student.countDocuments({
      _id: { $in: childStudentIds },
      schoolId: req.user.schoolId
    });

    if (validCount !== childStudentIds.length) {
      return res.status(400).json({ message: "One or more childStudentIds are invalid" });
    }
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({
    fullName,
    email: email.toLowerCase(),
    passwordHash,
    role,
    schoolId: req.user.schoolId,
    studentProfileId: studentProfileId || null,
    childStudentIds
  });

  if (role === "parent" && childStudentIds.length) {
    await Student.updateMany(
      { _id: { $in: childStudentIds } },
      {
        $addToSet: { parentUserIds: user._id }
      }
    );
  }

  return res.status(201).json(toPublicUser(user));
};

export const listUsers = async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = { schoolId: req.user.schoolId };

  if (req.query.role) {
    filter.role = req.query.role;
  }

  const [items, total] = await Promise.all([
    User.find(filter)
      .select("-passwordHash")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(filter)
  ]);

  return res.json({
    items,
    meta: buildPageMeta(page, limit, total)
  });
};

export const createStudentProfile = async (req, res) => {
  const { fullName, admissionNumber, grade, section, dateOfBirth, parentUserIds = [], teacherUserIds = [] } = req.body;

  const duplicate = await Student.findOne({
    schoolId: req.user.schoolId,
    admissionNumber: String(admissionNumber).trim()
  });

  if (duplicate) {
    return res.status(409).json({ message: "admissionNumber already exists in this school" });
  }

  const student = await Student.create({
    schoolId: req.user.schoolId,
    fullName,
    admissionNumber: String(admissionNumber).trim(),
    grade,
    section: section || "A",
    dateOfBirth: dateOfBirth || null,
    parentUserIds,
    teacherUserIds
  });

  return res.status(201).json(student);
};

export const listStudents = async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = { schoolId: req.user.schoolId };

  if (req.query.grade) filter.grade = req.query.grade;
  if (req.query.section) filter.section = req.query.section;

  const [items, total] = await Promise.all([
    Student.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Student.countDocuments(filter)
  ]);

  return res.json({
    items,
    meta: buildPageMeta(page, limit, total)
  });
};

export const listStudentClasses = async (req, res) => {
  const items = await Student.aggregate([
    { $match: { schoolId: req.user.schoolId } },
    {
      $group: {
        _id: {
          grade: "$grade",
          section: "$section"
        },
        count: { $sum: 1 }
      }
    },
    {
      $project: {
        _id: 0,
        grade: "$_id.grade",
        section: "$_id.section",
        count: 1
      }
    },
    { $sort: { grade: 1, section: 1 } }
  ]);

  return res.json({ items });
};

export const createSubject = async (req, res) => {
  const { name, code, teacherUserId } = req.body;

  const duplicate = await Subject.findOne({
    schoolId: req.user.schoolId,
    code: String(code).toUpperCase()
  });

  if (duplicate) {
    return res.status(409).json({ message: "Subject code already exists in this school" });
  }

  const subject = await Subject.create({
    schoolId: req.user.schoolId,
    name,
    code: String(code).toUpperCase(),
    teacherUserId: teacherUserId || null
  });

  return res.status(201).json(subject);
};

export const listSubjects = async (req, res) => {
  const items = await Subject.find({ schoolId: req.user.schoolId }).sort({ name: 1 }).lean();
  return res.json({ items });
};

export const schoolAnalytics = async (req, res) => {
  const analytics = await getSchoolAnalytics(req.user.schoolId);
  return res.json(analytics);
};
