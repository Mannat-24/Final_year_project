import { getTenantDatabases, getDbPool } from "../config/db.js";

export const tenantDbMiddleware = async (req, res, next) => {
  try {
    const domain = req.user.domain;
    const { teacherDbName, studentDbName } = await getTenantDatabases(domain);
    req.tenant = {
      teacherDbName,
      studentDbName,
      teacherDb: getDbPool(teacherDbName),
      studentDb: getDbPool(studentDbName)
    };
    next();
  } catch (error) {
    next(error);
  }
};
