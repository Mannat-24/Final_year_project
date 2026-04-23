import { Student } from "../models/Student.js";
import { evaluateStudentInsights } from "../services/insightService.js";
import { predictRiskLevel } from "../services/mlService.js";

const average = (values = []) => {
  if (!values.length) return 0;
  return Number((values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length).toFixed(2));
};

export const predictRisk = async (req, res) => {
  const { marks, attendance, pastPerformance } = req.body;

  const prediction = await predictRiskLevel({
    marks,
    attendance,
    pastPerformance
  });

  return res.json(prediction);
};

export const predictRiskForStudent = async (req, res) => {
  const student = await Student.findOne({ _id: req.params.studentId, schoolId: req.user.schoolId }).lean();

  if (!student) {
    return res.status(404).json({ message: "Student not found in your school" });
  }

  const insightData = await evaluateStudentInsights({
    schoolId: req.user.schoolId,
    studentId: student._id,
    notify: false
  });

  const trendScores = (insightData.trendSeries || []).map((item) => Number(item.score || 0));
  const pastPerformance = trendScores.length > 1
    ? average(trendScores.slice(0, trendScores.length - 1))
    : insightData.averageMarks;

  const features = {
    marks: Number(insightData.averageMarks || 0),
    attendance: Number(insightData.attendancePercentage || 0),
    pastPerformance
  };

  const prediction = await predictRiskLevel(features);

  return res.json({
    studentId: student._id,
    studentName: student.fullName,
    features,
    ...prediction
  });
};
