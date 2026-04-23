import { query } from "../config/db.js";
import { mapNotificationRow } from "../db/mappers.js";
import { buildPageMeta, getPagination } from "../utils/pagination.js";

export const listMyNotifications = async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);

  const [itemsResult, totalResult, unreadResult] = await Promise.all([
    query(
      `SELECT *
       FROM notifications
       WHERE recipient_user_id = $1
       ORDER BY created_at DESC
       OFFSET $2
       LIMIT $3`,
      [req.user._id, skip, limit]
    ),
    query(
      `SELECT COUNT(*)::int AS count
       FROM notifications
       WHERE recipient_user_id = $1`,
      [req.user._id]
    ),
    query(
      `SELECT COUNT(*)::int AS count
       FROM notifications
       WHERE recipient_user_id = $1
         AND is_read = FALSE`,
      [req.user._id]
    )
  ]);

  const items = itemsResult.rows.map((row) => mapNotificationRow(row));
  const total = Number(totalResult.rows[0]?.count || 0);
  const unreadCount = Number(unreadResult.rows[0]?.count || 0);

  return res.json({
    items,
    unreadCount,
    meta: buildPageMeta(page, limit, total)
  });
};

export const markNotificationRead = async (req, res) => {
  const { rows } = await query(
    `UPDATE notifications
     SET is_read = TRUE
     WHERE id = $1
       AND recipient_user_id = $2
     RETURNING *`,
    [req.params.notificationId, req.user._id]
  );

  if (!rows.length) {
    return res.status(404).json({ message: "Notification not found" });
  }

  return res.json(mapNotificationRow(rows[0]));
};

export const markAllNotificationsRead = async (req, res) => {
  await query(
    `UPDATE notifications
     SET is_read = TRUE
     WHERE recipient_user_id = $1
       AND is_read = FALSE`,
    [req.user._id]
  );

  return res.json({ message: "All notifications marked as read" });
};
