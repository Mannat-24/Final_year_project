import { coreDb } from "../config/db.js";
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

const isDomainAllowed = async (domain) => {
  const [rows] = await coreDb.query(
    "SELECT id FROM allowed_personal_domains WHERE domain = ? LIMIT 1",
    [String(domain || "").trim().toLowerCase()]
  );
  return rows.length > 0;
};

const validateSession = async (user) => {
  if (!user?.sessionId) return false;

  const [sessionRows] = await coreDb.query(
    `SELECT id
     FROM user_sessions
     WHERE session_id = ? AND user_id = ? AND revoked = 0 AND expires_at > NOW()
     LIMIT 1`,
    [user.sessionId, user.id]
  );

  if (!sessionRows.length) return false;

  await coreDb.query("UPDATE user_sessions SET last_seen_at = NOW() WHERE session_id = ?", [user.sessionId]);
  return true;
};

export const realtimeStream = async (req, res, next) => {
  try {
    const token = getTokenFromRequest(req);
    if (!token) {
      return res.status(401).json({ message: "Realtime auth token missing" });
    }

    let user;
    try {
      user = verifyToken(token);
    } catch {
      return res.status(401).json({ message: "Invalid realtime token" });
    }

    const activeSession = await validateSession(user);
    if (!activeSession) {
      return res.status(401).json({ message: "Session expired. Please login again" });
    }

    if (user.role !== "owner") {
      const allowed = await isDomainAllowed(user.domain);
      if (!allowed) {
        return res.status(403).json({ message: "Domain access blocked by owner" });
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
      domain: user.domain,
      role: user.role,
      userId: user.id
    });

    sendRealtimeConnected(res, {
      domain: user.domain,
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
