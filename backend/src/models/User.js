import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      unique: true
    },
    passwordHash: {
      type: String,
      required: true
    },
    role: {
      type: String,
      enum: ["owner", "admin", "teacher", "student", "parent"],
      required: true
    },
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      default: null,
      required: function requiredSchoolId() {
        return this.role !== "owner";
      },
      index: true
    },
    studentProfileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      default: null
    },
    childStudentIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Student"
      }
    ],
    passwordResetToken: {
      type: String,
      default: null,
      index: true
    },
    passwordResetExpiresAt: {
      type: Date,
      default: null
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

userSchema.index({ schoolId: 1, role: 1 });

export const User = mongoose.model("User", userSchema);
