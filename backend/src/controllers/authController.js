import bcrypt from "bcryptjs";
import crypto from "crypto";
import { AllowedSchool } from "../models/AllowedSchool.js";
import { School } from "../models/School.js";
import { Student } from "../models/Student.js";
import { User } from "../models/User.js";
import { signToken } from "../utils/jwt.js";

const publicUser = (user) => ({
  _id: user._id,
  fullName: user.fullName,
  email: user.email,
  role: user.role,
  schoolId: user.schoolId || null,
  studentProfileId: user.studentProfileId || null,
  childStudentIds: user.childStudentIds || []
});

const isSchoolAllowed = async (schoolId) => {
  if (!schoolId) return false;

  const [school, allowEntry] = await Promise.all([
    School.findOne({ _id: schoolId, isActive: true }).select("_id").lean(),
    AllowedSchool.findOne({ schoolId }).select("_id").lean()
  ]);

  return Boolean(school && allowEntry);
};

export const register = async (req, res) => {
  const {
    fullName,
    email,
    password,
    role,
    schoolCode,
    admissionNumber,
    grade,
    section,
    childAdmissionNumbers
  } = req.body;

  const school = await School.findOne({ code: String(schoolCode || "").toUpperCase(), isActive: true });
  if (!school) {
    return res.status(404).json({ message: "School not found or inactive" });
  }

  const schoolAllowed = await isSchoolAllowed(school._id);
  if (!schoolAllowed) {
    return res.status(403).json({ message: "This school code is not allowed by owner yet" });
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return res.status(409).json({ message: "Email already registered" });
  }

  let studentProfileId = null;
  let childStudentIds = [];

  if (role === "student") {
    if (!admissionNumber) {
      return res.status(400).json({ message: "admissionNumber is required for student role" });
    }

    let student = await Student.findOne({ schoolId: school._id, admissionNumber: String(admissionNumber).trim() });
    if (!student) {
      student = await Student.create({
        schoolId: school._id,
        admissionNumber: String(admissionNumber).trim(),
        fullName,
        grade: grade || "NA",
        section: section || "A"
      });
    }

    studentProfileId = student._id;
  }

  if (role === "parent" && Array.isArray(childAdmissionNumbers) && childAdmissionNumbers.length) {
    const children = await Student.find({
      schoolId: school._id,
      admissionNumber: { $in: childAdmissionNumbers.map((item) => String(item).trim()) }
    }).select("_id");

    childStudentIds = children.map((student) => student._id);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({
    fullName,
    email: email.toLowerCase(),
    passwordHash,
    role,
    schoolId: school._id,
    studentProfileId,
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

  const token = signToken(user);

  return res.status(201).json({
    token,
    user: publicUser(user)
  });
};

export const login = async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email: String(email).toLowerCase(), isActive: true });
  if (!user) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  if (user.role !== "owner") {
    const schoolAllowed = await isSchoolAllowed(user.schoolId);
    if (!schoolAllowed) {
      return res.status(403).json({ message: "Login blocked. Your school is not allowed by owner" });
    }
  }

  const token = signToken(user);
  return res.json({ token, user: publicUser(user) });
};

export const forgotPassword = async (req, res) => {
  const email = String(req.body.email || "").toLowerCase().trim();
  if (!email) {
    return res.status(400).json({ message: "email is required" });
  }

  const user = await User.findOne({ email, isActive: true });

  if (!user) {
    return res.json({ message: "If the email exists, a reset token has been generated" });
  }

  const resetToken = crypto.randomBytes(20).toString("hex");
  const passwordResetExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

  user.passwordResetToken = resetToken;
  user.passwordResetExpiresAt = passwordResetExpiresAt;
  await user.save();

  return res.json({
    message: "Reset token generated (demo mode). Use this token on reset page.",
    resetToken,
    expiresAt: passwordResetExpiresAt.toISOString()
  });
};

export const resetPassword = async (req, res) => {
  const token = String(req.body.token || "").trim();
  const newPassword = String(req.body.newPassword || "");

  if (!token || !newPassword) {
    return res.status(400).json({ message: "token and newPassword are required" });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ message: "Password must be at least 8 characters" });
  }

  const user = await User.findOne({
    passwordResetToken: token,
    passwordResetExpiresAt: { $gt: new Date() },
    isActive: true
  });

  if (!user) {
    return res.status(400).json({ message: "Invalid or expired reset token" });
  }

  user.passwordHash = await bcrypt.hash(newPassword, 12);
  user.passwordResetToken = null;
  user.passwordResetExpiresAt = null;
  await user.save();

  return res.json({ message: "Password reset successful" });
};

export const me = async (req, res) => {
  return res.json({ user: req.user });
};
