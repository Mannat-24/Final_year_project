import { useCallback, useEffect, useMemo, useState } from "react";
import client from "../api/client";
import { useRealtimeUpdates } from "../hooks/useRealtimeUpdates";
import DashboardLayout from "../layouts/DashboardLayout";

const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const StudentTimetablePage = () => {
  const [data, setData] = useState({ className: "", weeklyTimetable: [] });

  const load = useCallback(async () => {
    const response = await client.get("/student/timetable");
    setData(response.data);
  }, []);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  useRealtimeUpdates(
    useCallback(
      (event) => {
        if (event?.type === "timetable_updated") {
          load().catch(() => {});
        }
      },
      [load]
    )
  );

  const slotsByDay = useMemo(() => {
    return (data.weeklyTimetable || []).reduce((acc, slot) => {
      if (!acc[slot.dayOfWeek]) acc[slot.dayOfWeek] = [];
      acc[slot.dayOfWeek].push(slot);
      return acc;
    }, {});
  }, [data.weeklyTimetable]);

  return (
    <DashboardLayout title="Time table">
      <div className="card">
        <h3 className="mb-1 text-lg font-semibold">Weekly Time table</h3>
        <p className="text-sm text-slate-500 dark:text-slate-300">Class: {data.className || "-"}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {daysOfWeek.map((day) => {
          const daySlots = (slotsByDay[day] || []).sort((a, b) => a.periodNo - b.periodNo);

          return (
            <div key={day} className="card">
              <h4 className="mb-2 text-base font-semibold">{day}</h4>
              {daySlots.length ? (
                <ul className="space-y-2 text-sm">
                  {daySlots.map((slot) => (
                    <li key={slot.id} className="rounded-xl bg-slate-100 p-3 dark:bg-slate-800">
                      <p className="font-semibold">Period {slot.periodNo} • {slot.startTime} - {slot.endTime}</p>
                      <p>{slot.subjectName}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-300">
                        {slot.teacherName || "Teacher"}{slot.teacherEmail ? ` • ${slot.teacherEmail}` : ""}{slot.roomLabel ? ` • ${slot.roomLabel}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">No timetable slots published for this day.</p>
              )}
            </div>
          );
        })}
      </div>
    </DashboardLayout>
  );
};

export default StudentTimetablePage;
