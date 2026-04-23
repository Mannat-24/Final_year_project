import { AllowedSchool } from "../models/AllowedSchool.js";
import { School } from "../models/School.js";
import { User } from "../models/User.js";

export const createOwnerSchool = async (req, res) => {
  const {
    name,
    code,
    address = "",
    contactEmail = "",
    allowNow = true
  } = req.body;

  const normalizedCode = String(code || "").trim().toUpperCase();

  const existing = await School.findOne({ code: normalizedCode }).lean();
  if (existing) {
    return res.status(409).json({ message: "School code already exists" });
  }

  const school = await School.create({
    name: String(name).trim(),
    code: normalizedCode,
    address: String(address || "").trim(),
    contactEmail: String(contactEmail || "").trim()
  });

  if (allowNow) {
    await AllowedSchool.findOneAndUpdate(
      { schoolId: school._id },
      { schoolId: school._id, updatedBy: req.user._id },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  return res.status(201).json({
    _id: school._id,
    name: school.name,
    code: school.code,
    address: school.address,
    contactEmail: school.contactEmail,
    isActive: school.isActive,
    isAllowed: Boolean(allowNow),
    accountSummary: {
      totalAccounts: 0,
      admins: 0,
      teachers: 0,
      students: 0,
      parents: 0
    }
  });
};

export const listOwnerSchools = async (req, res) => {
  const [schools, allowedRows, accountCounts] = await Promise.all([
    School.find().sort({ createdAt: -1 }).lean(),
    AllowedSchool.find().select("schoolId").lean(),
    User.aggregate([
      {
        $match: {
          schoolId: { $ne: null }
        }
      },
      {
        $group: {
          _id: "$schoolId",
          totalAccounts: { $sum: 1 },
          admins: {
            $sum: {
              $cond: [{ $eq: ["$role", "admin"] }, 1, 0]
            }
          },
          teachers: {
            $sum: {
              $cond: [{ $eq: ["$role", "teacher"] }, 1, 0]
            }
          },
          students: {
            $sum: {
              $cond: [{ $eq: ["$role", "student"] }, 1, 0]
            }
          },
          parents: {
            $sum: {
              $cond: [{ $eq: ["$role", "parent"] }, 1, 0]
            }
          }
        }
      }
    ])
  ]);

  const allowedSet = new Set(allowedRows.map((item) => String(item.schoolId)));
  const countMap = new Map(accountCounts.map((item) => [String(item._id), item]));

  const items = schools.map((school) => {
    const counts = countMap.get(String(school._id)) || {
      totalAccounts: 0,
      admins: 0,
      teachers: 0,
      students: 0,
      parents: 0
    };

    return {
      _id: school._id,
      name: school.name,
      code: school.code,
      address: school.address,
      contactEmail: school.contactEmail,
      isActive: school.isActive,
      isAllowed: allowedSet.has(String(school._id)),
      accountSummary: {
        totalAccounts: counts.totalAccounts,
        admins: counts.admins,
        teachers: counts.teachers,
        students: counts.students,
        parents: counts.parents
      }
    };
  });

  return res.json({
    items,
    allowedCount: items.filter((item) => item.isAllowed).length,
    totalCount: items.length
  });
};

export const allowSchoolForAccess = async (req, res) => {
  const school = await School.findById(req.params.schoolId).lean();
  if (!school) {
    return res.status(404).json({ message: "School not found" });
  }

  await AllowedSchool.findOneAndUpdate(
    { schoolId: school._id },
    { schoolId: school._id, updatedBy: req.user._id },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return res.json({ message: `School ${school.code} is now allowed for login/signup` });
};

export const disallowSchoolForAccess = async (req, res) => {
  const school = await School.findById(req.params.schoolId).lean();
  if (!school) {
    return res.status(404).json({ message: "School not found" });
  }

  await AllowedSchool.deleteOne({ schoolId: school._id });

  return res.json({ message: `School ${school.code} has been removed from allowlist` });
};
