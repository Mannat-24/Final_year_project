import mongoose from "mongoose";

const performanceRecordSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: true
    },
    teacherUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    examType: {
      type: String,
      required: true,
      trim: true
    },
    marksObtained: {
      type: Number,
      required: true,
      min: 0
    },
    maxMarks: {
      type: Number,
      required: true,
      min: 1
    },
    examDate: {
      type: Date,
      required: true,
      index: true
    },
    remark: {
      type: String,
      default: ""
    },
    riskLevel: {
      type: String,
      enum: ["Low", "Medium", "High"],
      default: "Low"
    }
  },
  { timestamps: true }
);

performanceRecordSchema.index({ schoolId: 1, studentId: 1, examDate: -1 });
performanceRecordSchema.index({ studentId: 1, subjectId: 1, examDate: -1 });

export const PerformanceRecord = mongoose.model("PerformanceRecord", performanceRecordSchema);