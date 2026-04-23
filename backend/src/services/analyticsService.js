import mongoose from "mongoose";
import { AttendanceRecord } from "../models/AttendanceRecord.js";
import { PerformanceRecord } from "../models/PerformanceRecord.js";
import { User } from "../models/User.js";

export const getSchoolAnalytics = async (schoolId) => {
  const schoolObjectId = new mongoose.Types.ObjectId(String(schoolId));

  const [subjectAverages, attendanceSummary, performanceTrend, userBreakdown, classAttendance] = await Promise.all([
    PerformanceRecord.aggregate([
      { $match: { schoolId: schoolObjectId } },
      {
        $addFields: {
          percentage: {
            $multiply: [{ $divide: ["$marksObtained", "$maxMarks"] }, 100]
          }
        }
      },
      {
        $group: {
          _id: "$subjectId",
          averageMarks: { $avg: "$percentage" },
          recordCount: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: "subjects",
          localField: "_id",
          foreignField: "_id",
          as: "subject"
        }
      },
      { $unwind: "$subject" },
      {
        $project: {
          _id: 0,
          subjectId: "$subject._id",
          subjectName: "$subject.name",
          averageMarks: { $round: ["$averageMarks", 2] },
          recordCount: 1
        }
      },
      { $sort: { averageMarks: -1 } }
    ]),
    AttendanceRecord.aggregate([
      { $match: { schoolId: schoolObjectId } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      }
    ]),
    PerformanceRecord.aggregate([
      { $match: { schoolId: schoolObjectId } },
      {
        $addFields: {
          percentage: {
            $multiply: [{ $divide: ["$marksObtained", "$maxMarks"] }, 100]
          },
          month: { $dateToString: { format: "%Y-%m", date: "$examDate" } }
        }
      },
      {
        $group: {
          _id: "$month",
          avgScore: { $avg: "$percentage" }
        }
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          month: "$_id",
          avgScore: { $round: ["$avgScore", 2] }
        }
      }
    ]),
    User.aggregate([
      { $match: { schoolId: schoolObjectId } },
      {
        $group: {
          _id: "$role",
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          role: "$_id",
          count: 1
        }
      }
    ]),
    AttendanceRecord.aggregate([
      { $match: { schoolId: schoolObjectId } },
      {
        $lookup: {
          from: "students",
          localField: "studentId",
          foreignField: "_id",
          as: "student"
        }
      },
      { $unwind: "$student" },
      {
        $group: {
          _id: {
            grade: "$student.grade",
            section: "$student.section"
          },
          totalRecords: { $sum: 1 },
          presentLike: {
            $sum: {
              $cond: [{ $in: ["$status", ["Present", "Late"]] }, 1, 0]
            }
          },
          absent: {
            $sum: {
              $cond: [{ $eq: ["$status", "Absent"] }, 1, 0]
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          grade: "$_id.grade",
          section: "$_id.section",
          className: {
            $concat: ["Class ", { $toString: "$_id.grade" }, "-", { $toString: "$_id.section" }]
          },
          totalRecords: 1,
          presentLike: 1,
          absent: 1,
          attendancePercentage: {
            $round: [
              {
                $multiply: [{ $divide: ["$presentLike", "$totalRecords"] }, 100]
              },
              2
            ]
          }
        }
      },
      { $sort: { grade: 1, section: 1 } }
    ])
  ]);

  const totalAttendance = attendanceSummary.reduce((sum, entry) => sum + entry.count, 0);
  const presentLike = attendanceSummary
    .filter((entry) => ["Present", "Late"].includes(entry._id))
    .reduce((sum, entry) => sum + entry.count, 0);

  return {
    subjectAverages,
    attendancePercentage: totalAttendance
      ? Number(((presentLike / totalAttendance) * 100).toFixed(2))
      : 0,
    attendanceSummary,
    performanceTrend,
    userBreakdown,
    classAttendance
  };
};
