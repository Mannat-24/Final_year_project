import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import client from "../api/client";
import DashboardLayout from "../layouts/DashboardLayout";
import { useRealtimeUpdates } from "../hooks/useRealtimeUpdates";

const toPercent = (obtained, max) => {
  if (!max) return 0;
  return Number((((obtained / max) * 100) || 0).toFixed(2));
};

const TeacherProgressPage = () => {
  const [students, setStudents] = useState([]);
  const [selectedGrade, setSelectedGrade] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [studentId, setStudentId] = useState("");
  const [performance, setPerformance] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const gradeOptions = useMemo(
    () =>
      [...new Set((students || []).map((item) => String(item.grade || "").trim()).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
      ),
    [students]
  );

  const sectionOptions = useMemo(
    () =>
      [...new Set(
        (students || [])
          .filter((item) => String(item.grade || "").trim() === String(selectedGrade || ""))
          .map((item) => String(item.section || "A").trim())
      )].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })),
    [students, selectedGrade]
  );

  const filteredStudents = useMemo(
    () =>
      (students || []).filter(
        (item) =>
          String(item.grade || "").trim() === String(selectedGrade || "") &&
          String(item.section || "A").trim() === String(selectedSection || "")
      ),
    [students, selectedGrade, selectedSection]
  );

  const selectedStudent = useMemo(
    () => students.find((item) => item._id === studentId) || null,
    [students, studentId]
  );

  const loadReference = useCallback(async () => {
    const { data } = await client.get("/teacher/reference");
    setStudents(data.students || []);
  }, []);

  useEffect(() => {
    loadReference().catch(() => {});
  }, [loadReference]);

  useEffect(() => {
    if (!gradeOptions.length) {
      setSelectedGrade("");
      return;
    }

    if (!gradeOptions.includes(String(selectedGrade || ""))) {
      setSelectedGrade(gradeOptions[0]);
    }
  }, [gradeOptions, selectedGrade]);

  useEffect(() => {
    if (!sectionOptions.length) {
      setSelectedSection("");
      return;
    }

    if (!sectionOptions.includes(String(selectedSection || ""))) {
      setSelectedSection(sectionOptions[0]);
    }
  }, [sectionOptions, selectedSection]);

  useEffect(() => {
    if (!filteredStudents.length) {
      setStudentId("");
      return;
    }

    const exists = filteredStudents.some((item) => String(item._id) === String(studentId));
    if (!exists) {
      setStudentId(filteredStudents[0]._id);
    }
  }, [filteredStudents, studentId]);

  const loadDetails = useCallback(async () => {
    if (!studentId) {
      setPerformance([]);
      setAttendance([]);
      setPrediction(null);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const [performanceRes, attendanceRes, predictionRes] = await Promise.all([
        client.get("/teacher/performance", { params: { studentId, limit: 80 } }),
        client.get("/teacher/attendance", { params: { studentId, limit: 80 } }),
        client.get(`/ml/predict/student/${studentId}`)
      ]);

      setPerformance(performanceRes.data.items || []);
      setAttendance(attendanceRes.data.items || []);
      setPrediction(predictionRes.data || null);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load student insights");
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    loadDetails().catch(() => {});
  }, [loadDetails]);

  useRealtimeUpdates(
    useCallback(
      (event) => {
        if (event?.type === "marks_updated" || event?.type === "attendance_updated") {
          loadDetails().catch(() => {});
        }
      },
      [loadDetails]
    )
  );

  const subjectAverages = useMemo(() => {
    const map = new Map();

    performance.forEach((item) => {
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
  }, [performance]);

  const scoreTrend = useMemo(() => {
    return performance
      .map((item) => ({
        label: `${item.examType} ${new Date(item.examDate).toLocaleDateString("en-IN")}`,
        score: toPercent(item.marksObtained, item.maxMarks)
      }))
      .reverse();
  }, [performance]);

  const attendanceSummary = useMemo(() => {
    const map = new Map();
    attendance.forEach((item) => {
      map.set(item.status, (map.get(item.status) || 0) + 1);
    });

    return Array.from(map.entries()).map(([status, count]) => ({ status, count }));
  }, [attendance]);

  return (
    <DashboardLayout title="Teacher Student Insights">
      <div className="card space-y-3">
        <h3 className="text-lg font-semibold">Select Class and Student</h3>
        <div className="grid gap-3 md:grid-cols-[170px_170px_1fr_auto]">
          <select className="input" value={selectedGrade} onChange={(event) => setSelectedGrade(event.target.value)}>
            {gradeOptions.map((grade) => (
              <option key={grade} value={grade}>
                Grade {grade}
              </option>
            ))}
          </select>

          <select className="input" value={selectedSection} onChange={(event) => setSelectedSection(event.target.value)}>
            {sectionOptions.map((section) => (
              <option key={section} value={section}>
                Section {section}
              </option>
            ))}
          </select>

          <select className="input" value={studentId} onChange={(event) => setStudentId(event.target.value)}>
            {filteredStudents.map((student) => (
              <option key={student._id} value={student._id}>
                {student.fullName} ({student.admissionNumber})
              </option>
            ))}
          </select>

          <button className="btn-primary" onClick={() => loadDetails().catch(() => {})}>
            Refresh Insights
          </button>
        </div>
      </div>

      {loading ? <p className="card text-sm text-slate-500">Loading insights...</p> : null}
      {error ? <p className="card text-sm text-rose-700">{error}</p> : null}

      {selectedStudent ? (
        <div className="card">
          <h3 className="text-xl font-semibold">{selectedStudent.fullName}</h3>
          <p className="text-sm text-slate-500">
            Admission Number: {selectedStudent.admissionNumber} | Class {selectedStudent.grade}-{selectedStudent.section}
          </p>
          <p className="mt-2 text-sm">
            Predicted Risk Level: <span className="font-semibold">{prediction?.riskLevel || "-"}</span>
          </p>
        </div>
      ) : null}

      <div className="card">
        <h3 className="mb-2 text-lg font-semibold">ML Contributing Metrics</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="pb-2">Average Marks (%)</th>
                <th className="pb-2">Attendance (%)</th>
                <th className="pb-2">Past Performance (%)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-slate-200 dark:border-slate-700">
                <td className="py-2">{prediction?.features?.marks ?? "-"}</td>
                <td>{prediction?.features?.attendance ?? "-"}</td>
                <td>{prediction?.features?.pastPerformance ?? "-"}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="card h-80">
          <h3 className="mb-2 text-lg font-semibold">Score Trend (%)</h3>
          <ResponsiveContainer width="100%" height="90%">
            <LineChart data={scoreTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" hide />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Line type="monotone" dataKey="score" stroke="#0891b2" strokeWidth={3} dot={false} />
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
          <h3 className="mb-2 text-lg font-semibold">Performance Records</h3>
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
                {performance.map((item) => (
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

        <div className="card">
          <h3 className="mb-2 text-lg font-semibold">Attendance Summary</h3>
          <ul className="space-y-2 text-sm">
            {attendanceSummary.map((item) => (
              <li key={item.status} className="rounded-xl bg-slate-100 px-3 py-2 dark:bg-slate-800">
                {item.status}: <span className="font-semibold">{item.count}</span>
              </li>
            ))}
            {!attendanceSummary.length ? <li className="text-slate-500">No attendance data found.</li> : null}
          </ul>

          <h4 className="mb-2 mt-4 text-base font-semibold">Latest Attendance Logs</h4>
          <ul className="space-y-2 text-sm">
            {attendance.slice(0, 8).map((item) => (
              <li key={item._id} className="rounded-xl bg-slate-100 px-3 py-2 dark:bg-slate-800">
                {new Date(item.date).toLocaleDateString("en-IN")}: {item.status}
                {item.remark ? ` - ${item.remark}` : ""}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default TeacherProgressPage;
