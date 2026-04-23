import mongoose from "mongoose";

const timetableSlotSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true
    },
    className: {
      type: String,
      required: true,
      trim: true
    },
    dayOfWeek: {
      type: String,
      enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      required: true
    },
    periodNo: {
      type: Number,
      required: true,
      min: 1,
      max: 20
    },
    startTime: {
      type: String,
      required: true,
      trim: true
    },
    endTime: {
      type: String,
      required: true,
      trim: true
    },
    subjectName: {
      type: String,
      required: true,
      trim: true
    },
    roomLabel: {
      type: String,
      default: "",
      trim: true
    },
    teacherUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    }
  },
  { timestamps: true }
);

timetableSlotSchema.index({ schoolId: 1, className: 1, dayOfWeek: 1, periodNo: 1 }, { unique: true });
timetableSlotSchema.index({ schoolId: 1, className: 1, dayOfWeek: 1 });

export const TimeTableSlot = mongoose.model("TimeTableSlot", timetableSlotSchema);
