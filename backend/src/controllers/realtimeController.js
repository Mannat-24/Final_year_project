import { query } from "../config/db.js";
import { verifyToken } from "../utils/jwt.js";
import {
  registerRealtimeSubscriber,
  sendRealtimeConnected,
  unregisterRealtimeSubscriber
} from "../services/realtimeService.js";

const getTokenFromRequest = (req) => {
  const queryToken = String(req.query?.token || "").trim();
  if (queryToken) return queryToken;

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.replace("Bearer ", "").trim();
  }

  return "";
};

const isSchoolAllowed = async (schoolId) => {
  if (!schoolId) return false;

  const { rows } = await query(
    `SELECT s.id
     FROM schools s
     INNER JOIN allowed_schools a ON a.school_id = s.id
     WHERE s.id = $1 AND s.is_active = TRUE
     LIMIT 1`,
    [schoolId]
  );

  return rows.length > 0;
};

export const realtimeStream = async (req, res, next) => {
  try {
    const token = getTokenFromRequest(req);
    if (!token) {
      return res.status(401).json({ message: "Realtime auth token missing" });
    }

    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      return res.status(401).json({ message: "Invalid realtime token" });
    }

    const userResult = await query(
      `SELECT id, role, school_id, is_active
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [String(payload.sub)]
    );

    if (!userResult.rows.length || !userResult.rows[0].is_active) {
      return res.status(401).json({ message: "Session expired. Please login again" });
    }

    const user = {
      id: userResult.rows[0].id,
      role: userResult.rows[0].role,
      schoolId: userResult.rows[0].school_id
    };

    if (user.role !== "owner") {
      const allowed = await isSchoolAllowed(user.schoolId);
      if (!allowed) {
        return res.status(403).json({ message: "School access blocked by owner" });
      }
    }

    req.user = user;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    const subscriberId = registerRealtimeSubscriber({
      res,
      domain: String(user.schoolId || ""),
      role: user.role,
      userId: user.id
    });

    sendRealtimeConnected(res, {
      schoolId: user.schoolId,
      role: user.role,
      connectedAt: new Date().toISOString()
    });

    req.on("close", () => {
      unregisterRealtimeSubscriber(subscriberId);
      res.end();
    });
  } catch (error) {
    next(error);
  }
};
