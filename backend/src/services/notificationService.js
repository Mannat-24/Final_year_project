import { emitUserEvent } from "../config/socket.js";
import { query } from "../config/db.js";
import { mapNotificationRow } from "../db/mappers.js";

export const createNotifications = async ({
  schoolId,
  recipientUserIds,
  senderUserId,
  studentId,
  type,
  title,
  message,
  metadata = {}
}) => {
  const dedupedRecipients = [...new Set((recipientUserIds || []).map(String))].filter(Boolean);
  if (!dedupedRecipients.length) return [];

  const created = [];

  for (const recipientUserId of dedupedRecipients) {
    const { rows } = await query(
      `INSERT INTO notifications (
        school_id,
        recipient_user_id,
        sender_user_id,
        student_id,
        type,
        title,
        message,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
      RETURNING *`,
      [
        schoolId,
        recipientUserId,
        senderUserId || null,
        studentId || null,
        type,
        title,
        message,
        JSON.stringify(metadata || {})
      ]
    );

    const item = mapNotificationRow(rows[0]);
    created.push(item);

    emitUserEvent(String(item.recipientUserId), "notification:new", item);
  }

  return created;
};

export const listNotificationsForUser = async (userId, { page, limit, skip }) => {
  const [itemsResult, totalResult, unreadResult] = await Promise.all([
    query(
      `SELECT *
       FROM notifications
       WHERE recipient_user_id = $1
       ORDER BY created_at DESC
       OFFSET $2
       LIMIT $3`,
      [userId, skip, limit]
    ),
    query(
      `SELECT COUNT(*)::int AS count
       FROM notifications
       WHERE recipient_user_id = $1`,
      [userId]
    ),
    query(
      `SELECT COUNT(*)::int AS count
       FROM notifications
       WHERE recipient_user_id = $1
         AND is_read = FALSE`,
      [userId]
    )
  ]);

  return {
    items: itemsResult.rows.map((row) => mapNotificationRow(row)),
    total: Number(totalResult.rows[0]?.count || 0),
    unreadCount: Number(unreadResult.rows[0]?.count || 0)
  };
};
