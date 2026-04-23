import mongoose from "mongoose";

const extracurricularRecordSchema = new mongoose.Schema(
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
      required: true,
      index: true
    },
    activityType: {
      type: String,
      required: true,
      trim: true
    },
    activityName: {
      type: String,
      required: true,
      trim: true
    },
    level: {
      type: String,
      default: "School",
      trim: true
    },
    participationDate: {
      type: Date,
      required: true,
      index: true
    },
    remarks: {
      type: String,
      default: ""
    }
  },
  { timestamps: true }
);

extracurricularRecordSchema.index({ schoolId: 1, studentId: 1, participationDate: -1 });

export const ExtracurricularRecord = mongoose.model("ExtracurricularRecord", extracurricularRecordSchema);
