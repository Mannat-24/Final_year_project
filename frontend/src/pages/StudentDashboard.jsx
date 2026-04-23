import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import client from "../api/client";
import Avatar from "../components/Avatar";
import ProgressBar from "../components/ProgressBar";
import DashboardLayout from "../layouts/DashboardLayout";
import { useRealtimeUpdates } from "../hooks/useRealtimeUpdates";
import { downloadTextReportPdf } from "../utils/pdfExport";

const toPercent = (obtained, max) => {
  if (!max) return 0;
  return Number((((obtained / max) * 100) || 0).toFixed(2));
};

const StudentDashboard = () => {
  const [data, setData] = useState({
    student: null,
    metrics: { averageMarks: 0, attendancePercentage: 0, riskLevel: "Low" },
    trendSeries: [],
    insights: [],
    recentPerformance: [],
    recentAttendance: [],
    notifications: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [liveToast, setLiveToast] = useState(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await client.get("/student/dashboard");
      setData(response.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load student dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (!liveToast) return undefined;
    const timer = setTimeout(() => {
      setLiveToast(null);
    }, 4500);

    return () => clearTimeout(timer);
  }, [liveToast]);

  useRealtimeUpdates(
    useCallback(
      (event) => {
        if (event?.type === "notification_sent") {
          const payload = event?.payload || {};
          setLiveToast({
            title: payload.title || "New Notification",
            message: payload.message || "You have a new real-time update."
          });
        }

        if (event?.type === "marks_updated" || event?.type === "attendance_updated" || event?.type === "notification_sent") {
          loadDashboard().catch(() => {});
        }
      },
      [loadDashboard]
    )
  );

  const subjectAverages = useMemo(() => {
    const map = new Map();

    (data.recentPerformance || []).forEach((item) => {
      const key = item.subjectId?.name || "Subject";
      const pct = toPercent(item.marksObtained, item.maxMarks);
      const stats = map.get(key) || { total: 0, count: 0 };
      stats.total += pct;
      stats.count += 1;
      map.set(key, stats);
    });

    return Array.from(map.entries()).map(([subjectName, stats]) => ({
      subjectName,
      averageScore: Number((stats.total / stats.count).toFixed(2))
    }));
  }, [data.recentPerformance]);

  const attendanceSummary = useMemo(() => {
    const map = new Map();
    (data.recentAttendance || []).forEach((item) => {
      map.set(item.status, (map.get(item.status) || 0) + 1);
    });
    return Array.from(map.entries()).map(([status, count]) => ({ status, count }));
  }, [data.recentAttendance]);

  const downloadAttendancePdf = () => {
    const lines = [
      `Student: ${data.student?.fullName || "-"}`,
      `Admission Number: ${data.student?.admissionNumber || "-"}`,
      `Class: ${data.student?.grade || "-"}-${data.student?.section || "-"}`,
      "",
      "Attendance Summary"
    ];

    attendanceSummary.forEach((row) => {
      lines.push(`${row.status}: ${row.count}`);
    });

    lines.push("");
    lines.push(`Attendance Percentage: ${data.metrics?.attendancePercentage || 0}%`);

    downloadTextReportPdf({
      fileName: `${data.student?.admissionNumber || "student"}-attendance.pdf`,
      title: "Student Attendance Report",
      lines
    });
  };

  const downloadProgressPdf = async () => {
    try {
      const response = await client.get("/student/report", { responseType: "blob" });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${data.student?.admissionNumber || "student"}-progress-report.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      setError("Unable to download progress report right now");
    }
  };

  return (
    <DashboardLayout title="Student Dashboard">
      {loading ? <p className="card text-sm text-slate-600">Loading dashboard...</p> : null}
      {error ? <p className="card text-sm text-rose-700">{error}</p> : null}

      <div className="card">
        <div className="flex items-center gap-4">
          <Avatar name={data.student?.fullName} size="lg" />
          <div>
            <h3 className="text-xl font-semibold">{data.student?.fullName || "Student"}</h3>
            <p className="text-sm text-slate-500">
              Admission Number: {data.student?.admissionNumber || "-"}
            </p>
            <p className="text-sm text-slate-500">
              Class: {data.student?.grade || "-"}-{data.student?.section || "-"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="card">
          <p className="text-sm text-slate-500">Average Marks</p>
          <p className="text-2xl font-bold">{data.metrics?.averageMarks || 0}%</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">Attendance</p>
          <p className="text-2xl font-bold">{data.metrics?.attendancePercentage || 0}%</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">Predicted Risk</p>
          <p className="text-2xl font-bold">{data.metrics?.riskLevel || "Low"}</p>
        </div>
      </div>

      <div className="card">
        <h3 className="mb-2 text-lg font-semibold">Download Reports</h3>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" onClick={downloadAttendancePdf}>
            Download Attendance PDF
          </button>
          <button type="button" className="btn-secondary" onClick={downloadProgressPdf}>
            Download Progress PDF
          </button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="card h-80">
          <h3 className="mb-2 text-lg font-semibold">Performance Trend (%)</h3>
          <ResponsiveContainer width="100%" height="90%">
            <LineChart data={data.trendSeries || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="examType" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Line type="monotone" dataKey="score" stroke="#0284c7" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card h-80">
          <h3 className="mb-2 text-lg font-semibold">Attendance Distribution</h3>
          <ResponsiveContainer width="100%" height="90%">
            <PieChart>
              <Pie data={attendanceSummary} dataKey="count" nameKey="status" outerRadius={100} fill="#1f9d63" label />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card h-80">
        <h3 className="mb-2 text-lg font-semibold">Subject Averages (%)</h3>
        <ResponsiveContainer width="100%" height="90%">
          <BarChart data={subjectAverages}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="subjectName" />
            <YAxis domain={[0, 100]} />
            <Tooltip />
            <Bar dataKey="averageScore" fill="#0284c7" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card">
        <h3 className="mb-2 text-lg font-semibold">Recent Performance Records</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="pb-2">Date</th>
                <th className="pb-2">Subject</th>
                <th className="pb-2">Exam</th>
                <th className="pb-2">Marks</th>
                <th className="pb-2">%</th>
              </tr>
            </thead>
            <tbody>
              {(data.recentPerformance || []).map((item) => (
                <tr key={item._id} className="border-t border-slate-200 dark:border-slate-700">
                  <td className="py-2">{new Date(item.examDate).toLocaleDateString("en-IN")}</td>
                  <td>{item.subjectId?.name || "-"}</td>
                  <td>{item.examType}</td>
                  <td>
                    {item.marksObtained}/{item.maxMarks}
                  </td>
                  <td>{toPercent(item.marksObtained, item.maxMarks)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="card space-y-3">
          <h3 className="text-lg font-semibold">AI Suggestions</h3>
          {(data.insights || []).length ? (
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {data.insights.map((insight, index) => (
                <li key={`${insight}-${index}`}>{insight}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">No major alerts right now. Keep consistency high.</p>
          )}
        </div>

        <div className="card space-y-3">
          <h3 className="text-lg font-semibold">Progress Bars</h3>
          <ProgressBar label="Average Marks" value={Number(data.metrics?.averageMarks || 0)} />
          <ProgressBar label="Attendance" value={Number(data.metrics?.attendancePercentage || 0)} />
          {subjectAverages.map((item) => (
            <ProgressBar key={item.subjectName} label={item.subjectName} value={item.averageScore} />
          ))}
        </div>
      </div>

      <div className="card">
        <h3 className="mb-2 text-lg font-semibold">Notifications</h3>
        <div className="space-y-2">
          {(data.notifications || []).map((notification) => (
            <div key={notification._id} className="rounded-xl bg-slate-100 p-3 dark:bg-slate-800">
              <p className="font-semibold">{notification.title}</p>
              <p className="text-sm text-slate-700 dark:text-slate-200">{notification.message}</p>
              <p className="mt-1 text-xs text-slate-500">
                {new Date(notification.createdAt).toLocaleString("en-IN")}
              </p>
            </div>
          ))}
          {!data.notifications?.length ? <p className="text-sm text-slate-500">No notifications yet.</p> : null}
        </div>
      </div>

      {liveToast ? (
        <div className="fixed bottom-20 right-4 z-50 w-[320px] rounded-2xl border border-cyan-200 bg-white p-4 shadow-xl dark:border-cyan-800 dark:bg-slate-900">
          <p className="text-sm font-semibold text-cyan-700 dark:text-cyan-300">{liveToast.title}</p>
          <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{liveToast.message}</p>
        </div>
      ) : null}
    </DashboardLayout>
  );
};

export default StudentDashboard;
