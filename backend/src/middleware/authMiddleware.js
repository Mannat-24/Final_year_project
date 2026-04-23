import { query } from "../config/db.js";
import { mapUserRow } from "../db/mappers.js";
import { verifyToken } from "../utils/jwt.js";

const toSessionUser = (user) => ({
  _id: user._id,
  fullName: user.fullName,
  email: user.email,
  role: user.role,
  schoolId: user.schoolId,
  studentProfileId: user.studentProfileId,
  childStudentIds: user.childStudentIds,
  isActive: user.isActive,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt
});

export const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const payload = verifyToken(token);
    const { rows } = await query(
      `SELECT *
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [String(payload.sub)]
    );

    if (!rows.length) {
      return res.status(401).json({ message: "Invalid or inactive user" });
    }

    const user = mapUserRow(rows[0]);
    if (!user.isActive) {
      return res.status(401).json({ message: "Invalid or inactive user" });
    }

    req.user = toSessionUser(user);
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
};

export const requireRoles = (...allowedRoles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }

  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ message: "You do not have permission for this action" });
  }

  return next();
};
