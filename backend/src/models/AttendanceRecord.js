import mongoose from "mongoose";

const attendanceRecordSchema = new mongoose.Schema(
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
    teacherUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    date: {
      type: Date,
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ["Present", "Absent", "Late"],
      required: true
    },
    remark: {
      type: String,
      default: ""
    }
  },
  { timestamps: true }
);

attendanceRecordSchema.index({ studentId: 1, date: 1 }, { unique: true });
attendanceRecordSchema.index({ schoolId: 1, date: -1 });

export const AttendanceRecord = mongoose.model("AttendanceRecord", attendanceRecordSchema);