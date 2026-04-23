import bcrypt from "bcryptjs";
import { connectDb } from "../src/config/db.js";
import { AttendanceRecord } from "../src/models/AttendanceRecord.js";
import { AllowedSchool } from "../src/models/AllowedSchool.js";
import { Notification } from "../src/models/Notification.js";
import { PerformanceRecord } from "../src/models/PerformanceRecord.js";
import { School } from "../src/models/School.js";
import { Student } from "../src/models/Student.js";
import { Subject } from "../src/models/Subject.js";
import { TimeTableSlot } from "../src/models/TimeTableSlot.js";
import { User } from "../src/models/User.js";

const buildPastDate = (daysAgo) => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(0, 0, 0, 0);
  return date;
};

const hashPassword = (plain) => bcrypt.hash(plain, 12);

const seed = async () => {
  await connectDb();

  await Promise.all([
    Notification.deleteMany({}),
    AttendanceRecord.deleteMany({}),
    PerformanceRecord.deleteMany({}),
    TimeTableSlot.deleteMany({}),
    AllowedSchool.deleteMany({}),
    User.deleteMany({}),
    Subject.deleteMany({}),
    Student.deleteMany({}),
    School.deleteMany({})
  ]);

  const school = await School.create({
    name: "Greenfield Public School",
    code: "GFPS01",
    address: "Bengaluru, India",
    contactEmail: "office@gfps.edu"
  });

  const secondSchool = await School.create({
    name: "Horizon International School",
    code: "HIS02",
    address: "Pune, India",
    contactEmail: "admin@horizon.edu"
  });

  const [ownerPassword, managerPassword, adminPassword, teacherPassword, studentPassword, parentPassword] = await Promise.all([
    hashPassword("34567890"),
    hashPassword("Mannu@2402"),
    hashPassword("Admin@123"),
    hashPassword("Teacher@123"),
    hashPassword("Student@123"),
    hashPassword("Parent@123")
  ]);

  const owner = await User.create({
    fullName: "Owner",
    email: "abc123@gmail.com",
    passwordHash: ownerPassword,
    role: "owner",
    schoolId: null
  });

  await User.create({
    fullName: "Mannat Pangotra",
    email: "mannatpangotra29@gmail.com",
    passwordHash: managerPassword,
    role: "admin",
    schoolId: school._id
  });

  await User.create({
    fullName: "School Admin",
    email: "admin@gfps.edu",
    passwordHash: adminPassword,
    role: "admin",
    schoolId: school._id
  });

  const teacher = await User.create({
    fullName: "Anita Sharma",
    email: "teacher@gfps.edu",
    passwordHash: teacherPassword,
    role: "teacher",
    schoolId: school._id
  });

  const studentProfile = await Student.create({
    schoolId: school._id,
    admissionNumber: "GFPS-1001",
    fullName: "Rahul Verma",
    grade: "10",
    section: "A",
    teacherUserIds: [teacher._id]
  });

  const secondStudent = await Student.create({
    schoolId: school._id,
    admissionNumber: "GFPS-1002",
    fullName: "Aarav Gupta",
    grade: "10",
    section: "A",
    teacherUserIds: [teacher._id]
  });

  const parent = await User.create({
    fullName: "Priya Verma",
    email: "parent@gfps.edu",
    passwordHash: parentPassword,
    role: "parent",
    schoolId: school._id,
    childStudentIds: [studentProfile._id]
  });

  const studentUser = await User.create({
    fullName: "Rahul Verma",
    email: "student@gfps.edu",
    passwordHash: studentPassword,
    role: "student",
    schoolId: school._id,
    studentProfileId: studentProfile._id
  });

  await Student.updateOne(
    { _id: studentProfile._id },
    {
      $set: { parentUserIds: [parent._id], teacherUserIds: [teacher._id] }
    }
  );

  const subjects = await Subject.insertMany([
    { schoolId: school._id, name: "Mathematics", code: "MATH", teacherUserId: teacher._id },
    { schoolId: school._id, name: "Science", code: "SCI", teacherUserId: teacher._id },
    { schoolId: school._id, name: "English", code: "ENG", teacherUserId: teacher._id }
  ]);

  const [math, science, english] = subjects;

  await PerformanceRecord.insertMany([
    {
      schoolId: school._id,
      studentId: studentProfile._id,
      subjectId: math._id,
      teacherUserId: teacher._id,
      examType: "UT-1",
      marksObtained: 15,
      maxMarks: 20,
      examDate: buildPastDate(35),
      remark: "Good start",
      riskLevel: "Low"
    },
    {
      schoolId: school._id,
      studentId: studentProfile._id,
      subjectId: science._id,
      teacherUserId: teacher._id,
      examType: "UT-1",
      marksObtained: 9,
      maxMarks: 20,
      examDate: buildPastDate(35),
      remark: "Needs concept revision",
      riskLevel: "Medium"
    },
    {
      schoolId: school._id,
      studentId: studentProfile._id,
      subjectId: english._id,
      teacherUserId: teacher._id,
      examType: "UT-1",
      marksObtained: 14,
      maxMarks: 20,
      examDate: buildPastDate(35),
      remark: "Consistent",
      riskLevel: "Low"
    },
    {
      schoolId: school._id,
      studentId: studentProfile._id,
      subjectId: math._id,
      teacherUserId: teacher._id,
      examType: "UT-2",
      marksObtained: 11,
      maxMarks: 20,
      examDate: buildPastDate(15),
      remark: "Declining attention",
      riskLevel: "Medium"
    },
    {
      schoolId: school._id,
      studentId: studentProfile._id,
      subjectId: science._id,
      teacherUserId: teacher._id,
      examType: "UT-2",
      marksObtained: 7,
      maxMarks: 20,
      examDate: buildPastDate(15),
      remark: "Critical improvement needed",
      riskLevel: "High"
    },
    {
      schoolId: school._id,
      studentId: secondStudent._id,
      subjectId: math._id,
      teacherUserId: teacher._id,
      examType: "UT-2",
      marksObtained: 18,
      maxMarks: 20,
      examDate: buildPastDate(12),
      remark: "Excellent",
      riskLevel: "Low"
    }
  ]);

  await AttendanceRecord.insertMany([
    { schoolId: school._id, studentId: studentProfile._id, teacherUserId: teacher._id, date: buildPastDate(6), status: "Present" },
    { schoolId: school._id, studentId: studentProfile._id, teacherUserId: teacher._id, date: buildPastDate(5), status: "Absent" },
    { schoolId: school._id, studentId: studentProfile._id, teacherUserId: teacher._id, date: buildPastDate(4), status: "Late" },
    { schoolId: school._id, studentId: studentProfile._id, teacherUserId: teacher._id, date: buildPastDate(3), status: "Absent" },
    { schoolId: school._id, studentId: studentProfile._id, teacherUserId: teacher._id, date: buildPastDate(2), status: "Present" },
    { schoolId: school._id, studentId: secondStudent._id, teacherUserId: teacher._id, date: buildPastDate(2), status: "Present" }
  ]);

  await TimeTableSlot.insertMany([
    {
      schoolId: school._id,
      className: "Class 10-A",
      dayOfWeek: "Monday",
      periodNo: 1,
      startTime: "08:00",
      endTime: "08:45",
      subjectName: "Mathematics",
      roomLabel: "Room 101",
      teacherUserId: teacher._id
    },
    {
      schoolId: school._id,
      className: "Class 10-A",
      dayOfWeek: "Monday",
      periodNo: 2,
      startTime: "08:50",
      endTime: "09:35",
      subjectName: "Science",
      roomLabel: "Lab 2",
      teacherUserId: teacher._id
    },
    {
      schoolId: school._id,
      className: "Class 10-A",
      dayOfWeek: "Tuesday",
      periodNo: 1,
      startTime: "08:00",
      endTime: "08:45",
      subjectName: "English",
      roomLabel: "Room 103",
      teacherUserId: teacher._id
    }
  ]);

  await Notification.insertMany([
    {
      schoolId: school._id,
      recipientUserId: parent._id,
      senderUserId: teacher._id,
      studentId: studentProfile._id,
      type: "attendance",
      title: "Low attendance detected",
      message: "Rahul has frequent absences in the past week."
    },
    {
      schoolId: school._id,
      recipientUserId: studentUser._id,
      senderUserId: teacher._id,
      studentId: studentProfile._id,
      type: "performance",
      title: "Science performance alert",
      message: "Science score dropped below 40%."
    }
  ]);

  await AllowedSchool.insertMany([
    { schoolId: school._id, updatedBy: owner._id },
    { schoolId: secondSchool._id, updatedBy: owner._id }
  ]);

  console.log("Seed complete");
  console.log("School codes: GFPS01, HIS02");
  console.log("Owner: abc123@gmail.com / 34567890");
  console.log("Admin: admin@gfps.edu / Admin@123");
  console.log("Admin (manager): mannatpangotra29@gmail.com / Mannu@2402");
  console.log("Teacher: teacher@gfps.edu / Teacher@123");
  console.log("Student: student@gfps.edu / Student@123");
  console.log("Parent: parent@gfps.edu / Parent@123");

  process.exit(0);
};

seed().catch((error) => {
  console.error("Seed failed", error);
  process.exit(1);
});
