import { Notification } from "../models/Notification.js";
import { buildPageMeta, getPagination } from "../utils/pagination.js";

export const listMyNotifications = async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);

  const [items, total, unreadCount] = await Promise.all([
    Notification.find({ recipientUserId: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Notification.countDocuments({ recipientUserId: req.user._id }),
    Notification.countDocuments({ recipientUserId: req.user._id, isRead: false })
  ]);

  return res.json({
    items,
    unreadCount,
    meta: buildPageMeta(page, limit, total)
  });
};

export const markNotificationRead = async (req, res) => {
  const updated = await Notification.findOneAndUpdate(
    { _id: req.params.notificationId, recipientUserId: req.user._id },
    { isRead: true },
    { new: true }
  ).lean();

  if (!updated) {
    return res.status(404).json({ message: "Notification not found" });
  }

  return res.json(updated);
};

export const markAllNotificationsRead = async (req, res) => {
  await Notification.updateMany(
    { recipientUserId: req.user._id, isRead: false },
    { $set: { isRead: true } }
  );

  return res.json({ message: "All notifications marked as read" });
};