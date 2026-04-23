import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import client from "../api/client";
import Avatar from "../components/Avatar";
import DashboardLayout from "../layouts/DashboardLayout";
import { useRealtimeUpdates } from "../hooks/useRealtimeUpdates";

const toPercent = (obtained, max) => {
  if (!max) return 0;
  return Number((((obtained / max) * 100) || 0).toFixed(2));
};

const ParentDashboard = () => {
  const [dashboard, setDashboard] = useState({ children: [], notifications: [] });
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [childDetail, setChildDetail] = useState({
    child: null,
    metrics: { averageMarks: 0, attendancePercentage: 0, riskLevel: "Low" },
    insights: [],
    trendSeries: [],
    performance: [],
    attendance: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    const { data } = await client.get("/parent/dashboard");
    setDashboard(data);

    if (data.children?.length) {
      setSelectedStudentId((prev) => prev || data.children[0].student._id);
    }
  }, []);

  const loadChildDetail = useCallback(async () => {
    if (!selectedStudentId) return;

    const { data } = await client.get(`/parent/children/${selectedStudentId}`);
    setChildDetail(data);
  }, [selectedStudentId]);

  useEffect(() => {
    setLoading(true);
    setError("");

    Promise.all([loadDashboard()])
      .catch((err) => {
        setError(err.response?.data?.message || "Failed to load parent dashboard");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [loadDashboard]);

  useEffect(() => {
    loadChildDetail().catch(() => {});
  }, [loadChildDetail]);

  useRealtimeUpdates(
    useCallback(
      (event) => {
        if (event?.type === "marks_updated" || event?.type === "attendance_updated" || event?.type === "notification_sent") {
          loadDashboard().catch(() => {});
          loadChildDetail().catch(() => {});
        }
      },
      [loadDashboard, loadChildDetail]
    )
  );

  const selectedChildSummary = useMemo(
    () => dashboard.children.find((item) => item.student?._id === selectedStudentId) || null,
    [dashboard.children, selectedStudentId]
  );

  const subjectAverages = useMemo(() => {
    const map = new Map();

    (childDetail.performance || []).forEach((item) => {
      const key = item.subjectId?.name || "Subject";
      const percent = toPercent(item.marksObtained, item.maxMarks);
      const stats = map.get(key) || { total: 0, count: 0 };
      stats.total += percent;
      stats.count += 1;
      map.set(key, stats);
    });

    return Array.from(map.entries()).map(([subjectName, stats]) => ({
      subjectName,
      averageScore: Number((stats.total / stats.count).toFixed(2))
    }));
  }, [childDetail.performance]);

  const downloadChildReport = async () => {
    if (!selectedStudentId) return;

    try {
      const response = await client.get(`/parent/children/${selectedStudentId}/report`, { responseType: "blob" });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${selectedChildSummary?.student?.admissionNumber || "child"}-report.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      setError("Unable to download report right now");
    }
  };

  return (
    <DashboardLayout title="Parent Dashboard">
      {loading ? <p className="card text-sm text-slate-500">Loading parent dashboard...</p> : null}
      {error ? <p className="card text-sm text-rose-700">{error}</p> : null}

      <div className="card space-y-3">
        <h3 className="text-lg font-semibold">Select Child</h3>
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <select className="input" value={selectedStudentId} onChange={(event) => setSelectedStudentId(event.target.value)}>
            {(dashboard.children || []).map((item) => (
              <option key={item.student._id} value={item.student._id}>
                {item.student.fullName} ({item.student.admissionNumber})
              </option>
            ))}
          </select>
          <button className="btn-secondary" onClick={downloadChildReport} disabled={!selectedStudentId}>
            Download Report PDF
          </button>
        </div>
      </div>

      {selectedChildSummary ? (
        <div className="card">
          <div className="flex items-center gap-4">
            <Avatar name={selectedChildSummary.student?.fullName} size="lg" />
            <div>
              <h3 className="text-xl font-semibold">{selectedChildSummary.student?.fullName}</h3>
              <p className="text-sm text-slate-500">
                Admission Number: {selectedChildSummary.student?.admissionNumber} | Class {selectedChildSummary.student?.grade}-{selectedChildSummary.student?.section}
              </p>
              <p className="text-sm text-slate-500">
                Average Marks: {selectedChildSummary.averageMarks}% | Attendance: {selectedChildSummary.attendancePercentage}% | Risk: {selectedChildSummary.riskLevel}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="card h-80">
          <h3 className="mb-2 text-lg font-semibold">Performance Trend (%)</h3>
          <ResponsiveContainer width="100%" height="90%">
            <LineChart data={childDetail.trendSeries || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="examType" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Line type="monotone" dataKey="score" stroke="#0284c7" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
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
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="card">
          <h3 className="mb-2 text-lg font-semibold">Child Insights</h3>
          {(childDetail.insights || []).length ? (
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {childDetail.insights.map((insight, index) => (
                <li key={`${insight}-${index}`}>{insight}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">No major alerts at the moment.</p>
          )}
        </div>

        <div className="card">
          <h3 className="mb-2 text-lg font-semibold">Notifications</h3>
          <div className="space-y-2">
            {(dashboard.notifications || []).map((item) => (
              <div key={item._id} className="rounded-xl bg-slate-100 p-3 dark:bg-slate-800">
                <p className="font-semibold">{item.title}</p>
                <p className="text-sm">{item.message}</p>
                <p className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleString("en-IN")}</p>
              </div>
            ))}
            {!dashboard.notifications?.length ? <p className="text-sm text-slate-500">No notifications yet.</p> : null}
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="mb-2 text-lg font-semibold">Latest Performance Records</h3>
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
              {(childDetail.performance || []).map((item) => (
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
    </DashboardLayout>
  );
};

export default ParentDashboard;
