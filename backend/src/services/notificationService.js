import { emitUserEvent } from "../config/socket.js";
import { Notification } from "../models/Notification.js";

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

  const payload = dedupedRecipients.map((recipientUserId) => ({
    schoolId,
    recipientUserId,
    senderUserId: senderUserId || null,
    studentId: studentId || null,
    type,
    title,
    message,
    metadata
  }));

  const created = await Notification.insertMany(payload);

  created.forEach((item) => {
    emitUserEvent(String(item.recipientUserId), "notification:new", item);
  });

  return created;
};

export const listNotificationsForUser = async (userId, { page, limit, skip }) => {
  const [items, total, unreadCount] = await Promise.all([
    Notification.find({ recipientUserId: userId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Notification.countDocuments({ recipientUserId: userId }),
    Notification.countDocuments({ recipientUserId: userId, isRead: false })
  ]);

  return { items, total, unreadCount };
};