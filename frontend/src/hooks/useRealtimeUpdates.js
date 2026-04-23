import { useEffect } from "react";
import { useSocket } from "../context/SocketContext";

const eventAliases = {
  "performance:updated": "marks_updated",
  "attendance:updated": "attendance_updated",
  "notification:new": "notification_sent",
  "timetable:updated": "timetable_updated",
  "extracurricular:updated": "extracurricular_updated",
  marks_updated: "marks_updated",
  attendance_updated: "attendance_updated",
  notification_sent: "notification_sent",
  timetable_updated: "timetable_updated",
  extracurricular_updated: "extracurricular_updated"
};

export const useRealtimeUpdates = (onUpdate) => {
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket || typeof onUpdate !== "function") return undefined;

    const subscriptions = Object.entries(eventAliases).map(([sourceEvent, normalizedType]) => {
      const handler = (payload) => {
        onUpdate({ type: normalizedType, payload });
      };

      socket.on(sourceEvent, handler);
      return { sourceEvent, handler };
    });

    return () => {
      subscriptions.forEach(({ sourceEvent, handler }) => {
        socket.off(sourceEvent, handler);
      });
    };
  }, [socket, onUpdate]);
};
