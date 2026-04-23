import { useCallback, useEffect, useMemo, useState } from "react";
import client from "../api/client";
import { useRealtimeUpdates } from "../hooks/useRealtimeUpdates";
import DashboardLayout from "../layouts/DashboardLayout";

const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const TeacherTimetablePage = () => {
  const [timetable, setTimetable] = useState({ classes: [], className: "", slots: [] });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    className: "",
    dayOfWeek: "Monday",
    periodNo: 1,
    startTime: "08:00",
    endTime: "08:45",
    subjectName: "",
    roomLabel: ""
  });

  const load = useCallback(async (className) => {
    setLoading(true);
    try {
      const request = className ? { params: { className } } : undefined;
      const { data } = await client.get("/teacher/timetable", request);
      setTimetable(data);

      const selected = className || data.className || "";
      if (selected) {
        setForm((prev) => ({ ...prev, className: selected }));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  useRealtimeUpdates(
    useCallback(
      (event) => {
        if (event?.type === "timetable_updated") {
          const current = form.className || timetable.className || "";
          load(current).catch(() => {});
        }
      },
      [form.className, timetable.className, load]
    )
  );

  const onClassChange = async (className) => {
    setForm((prev) => ({ ...prev, className }));
    await load(className);
  };

  const submit = async (event) => {
    event.preventDefault();
    setMessage("");

    if (!form.className) {
      setMessage("Please select class first");
      return;
    }

    await client.post("/teacher/timetable/slot", {
      ...form,
      periodNo: Number(form.periodNo)
    });

    setMessage("Timetable slot saved");
    setForm((prev) => ({ ...prev, subjectName: "", roomLabel: "" }));
    await load(form.className);
  };

  const remove = async (slot) => {
    const className = form.className || timetable.className;
    if (!className) return;

    await client.delete("/teacher/timetable/slot", {
      data: {
        className,
        dayOfWeek: slot.dayOfWeek,
        periodNo: Number(slot.periodNo)
      }
    });

    setMessage(`Removed ${slot.dayOfWeek} period ${slot.periodNo}`);
    await load(className);
  };

  const slotsByDay = useMemo(() => {
    return (timetable.slots || []).reduce((acc, slot) => {
      if (!acc[slot.dayOfWeek]) acc[slot.dayOfWeek] = [];
      acc[slot.dayOfWeek].push(slot);
      return acc;
    }, {});
  }, [timetable.slots]);

  return (
    <DashboardLayout title="Time table">
      {message ? <p className="card text-sm text-emerald-700">{message}</p> : null}

      <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
        <form className="card space-y-2" onSubmit={submit}>
          <h3 className="text-lg font-semibold">Session Timetable Setup</h3>
          <p className="text-xs text-slate-500 dark:text-slate-300">
            Configure weekly schedule for a class. Students in that class will see updates instantly.
          </p>

          <select className="input" value={form.className} onChange={(e) => onClassChange(e.target.value)}>
            <option value="" disabled>
              Select Class
            </option>
            {(timetable.classes || []).map((item) => (
              <option key={item.className} value={item.className}>
                {item.className}
              </option>
            ))}
          </select>

          <select className="input" value={form.dayOfWeek} onChange={(e) => setForm((prev) => ({ ...prev, dayOfWeek: e.target.value }))}>
            {daysOfWeek.map((day) => (
              <option key={day} value={day}>
                {day}
              </option>
            ))}
          </select>

          <input
            className="input"
            type="number"
            min={1}
            max={20}
            value={form.periodNo}
            onChange={(e) => setForm((prev) => ({ ...prev, periodNo: e.target.value }))}
            placeholder="Period"
          />

          <div className="grid gap-2 sm:grid-cols-2">
            <input className="input" type="time" value={form.startTime} onChange={(e) => setForm((prev) => ({ ...prev, startTime: e.target.value }))} />
            <input className="input" type="time" value={form.endTime} onChange={(e) => setForm((prev) => ({ ...prev, endTime: e.target.value }))} />
          </div>

          <input className="input" value={form.subjectName} onChange={(e) => setForm((prev) => ({ ...prev, subjectName: e.target.value }))} placeholder="Subject" />
          <input className="input" value={form.roomLabel} onChange={(e) => setForm((prev) => ({ ...prev, roomLabel: e.target.value }))} placeholder="Room (optional)" />

          <button className="btn-primary w-full">Save Slot</button>
        </form>

        <div className="card">
          <h3 className="mb-2 text-lg font-semibold">Published Time table</h3>
          {loading ? <p className="text-sm text-slate-500">Loading...</p> : null}

          {!loading ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {daysOfWeek.map((day) => {
                const daySlots = (slotsByDay[day] || []).sort((a, b) => a.periodNo - b.periodNo);

                return (
                  <div key={day} className="rounded-xl bg-slate-100 p-3 dark:bg-slate-800">
                    <p className="mb-2 text-sm font-semibold">{day}</p>
                    {daySlots.length ? (
                      <ul className="space-y-2 text-xs">
                        {daySlots.map((slot) => (
                          <li key={slot.id} className="rounded-lg bg-white/80 px-2 py-2 dark:bg-slate-900/60">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium">
                                P{slot.periodNo} • {slot.startTime}-{slot.endTime}
                              </span>
                              <button type="button" className="text-xs text-red-600 underline" onClick={() => remove(slot)}>
                                Remove
                              </button>
                            </div>
                            <p>{slot.subjectName}{slot.roomLabel ? ` (${slot.roomLabel})` : ""}</p>
                            <p className="text-[11px] text-slate-500">{slot.teacherName}</p>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-slate-500">No slots</p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default TeacherTimetablePage;
