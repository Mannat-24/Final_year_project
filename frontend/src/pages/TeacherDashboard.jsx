import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import client from "../api/client";
import DashboardLayout from "../layouts/DashboardLayout";
import { useRealtimeUpdates } from "../hooks/useRealtimeUpdates";

const examOptions = ["UT-1", "UT-2", "TERM-1", "TERM-2", "ANNUAL"];
const activityTypeOptions = ["Sports", "Arts", "Music", "Dance", "Debate", "Coding", "Community Service", "Other"];
const activityLevelOptions = ["School", "Inter-School", "District", "State", "National", "International"];
const toDateInput = (value = new Date()) => new Date(value).toISOString().slice(0, 10);

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-IN");
};

const TeacherDashboard = () => {
  const [dashboard, setDashboard] = useState({
    totals: { totalStudents: 0, performanceUpdates: 0, attendanceUpdates: 0, pendingAttendanceThisWeek: 0 },
    recentPerformance: [],
    recentAttendance: []
  });
  const [reference, setReference] = useState({ students: [], subjects: [] });
  const [extracurricular, setExtracurricular] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [banner, setBanner] = useState("");

  const [performanceForm, setPerformanceForm] = useState({
    studentId: "",
    subjectId: "",
    examType: "UT-1",
    marksObtained: "",
    maxMarks: "20",
    examDate: toDateInput(),
    remark: ""
  });

  const [attendanceForm, setAttendanceForm] = useState({
    studentId: "",
    date: toDateInput(),
    status: "Present",
    remark: ""
  });

  const [activityForm, setActivityForm] = useState({
    recordId: "",
    studentId: "",
    activityType: "Sports",
    activityName: "",
    level: "School",
    participationDate: toDateInput(),
    remarks: ""
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [dashboardRes, referenceRes, activityRes] = await Promise.all([
        client.get("/teacher/dashboard"),
        client.get("/teacher/reference"),
        client.get("/teacher/extracurricular", { params: { limit: 100 } })
      ]);

      setDashboard(dashboardRes.data);
      setReference(referenceRes.data);
      setExtracurricular(activityRes.data.items || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load teacher dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!reference.students.length) return;

    setPerformanceForm((prev) => (prev.studentId ? prev : { ...prev, studentId: reference.students[0]._id }));
    setAttendanceForm((prev) => (prev.studentId ? prev : { ...prev, studentId: reference.students[0]._id }));
    setActivityForm((prev) => (prev.studentId ? prev : { ...prev, studentId: reference.students[0]._id }));
  }, [reference.students]);

  useEffect(() => {
    if (!reference.subjects.length) return;
    setPerformanceForm((prev) => (prev.subjectId ? prev : { ...prev, subjectId: reference.subjects[0]._id }));
  }, [reference.subjects]);

  const realtimeTypes = useMemo(
    () => new Set(["marks_updated", "attendance_updated", "notification_sent", "extracurricular_updated"]),
    []
  );

  useRealtimeUpdates(
    useCallback(
      (event) => {
        if (realtimeTypes.has(event?.type)) {
          loadData().catch(() => {});
        }
      },
      [loadData, realtimeTypes]
    )
  );

  const submitPerformance = async (event) => {
    event.preventDefault();
    setBanner("");
    setError("");

    try {
      const payload = {
        studentId: performanceForm.studentId,
        subjectId: performanceForm.subjectId,
        examType: performanceForm.examType,
        marksObtained: Number(performanceForm.marksObtained),
        maxMarks: Number(performanceForm.maxMarks),
        examDate: performanceForm.examDate,
        remark: performanceForm.remark
      };

      const { data } = await client.post("/teacher/performance", payload);
      setBanner(`Performance saved. Risk level: ${data.riskLevel}`);
      setPerformanceForm((prev) => ({ ...prev, marksObtained: "", remark: "" }));
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to save performance");
    }
  };

  const submitAttendance = async (event) => {
    event.preventDefault();
    setBanner("");
    setError("");

    try {
      const payload = {
        studentId: attendanceForm.studentId,
        date: attendanceForm.date,
        status: attendanceForm.status,
        remark: attendanceForm.remark
      };

      const { data } = await client.post("/teacher/attendance", payload);
      setBanner(`Attendance saved. Risk level: ${data.riskLevel}`);
      setAttendanceForm((prev) => ({ ...prev, remark: "" }));
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to save attendance");
    }
  };

  const submitActivity = async (event) => {
    event.preventDefault();
    setBanner("");
    setError("");

    try {
      const payload = {
        recordId: activityForm.recordId || undefined,
        studentId: activityForm.studentId,
        activityType: activityForm.activityType,
        activityName: activityForm.activityName,
        level: activityForm.level,
        participationDate: activityForm.participationDate,
        remarks: activityForm.remarks
      };

      await client.post("/teacher/extracurricular", payload);
      setBanner(activityForm.recordId ? "Extracurricular record updated" : "Extracurricular record added");

      setActivityForm((prev) => ({
        ...prev,
        recordId: "",
        activityName: "",
        remarks: "",
        participationDate: toDateInput()
      }));

      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to save extracurricular record");
    }
  };

  const editActivity = (item) => {
    setActivityForm({
      recordId: item._id,
      studentId: item.studentId?._id || "",
      activityType: item.activityType || "Sports",
      activityName: item.activityName || "",
      level: item.level || "School",
      participationDate: toDateInput(item.participationDate),
      remarks: item.remarks || ""
    });
  };

  const clearActivityEdit = () => {
    setActivityForm((prev) => ({
      ...prev,
      recordId: "",
      activityName: "",
      remarks: "",
      participationDate: toDateInput()
    }));
  };

  return (
    <DashboardLayout title="Teacher Dashboard">
      {loading ? <p className="card text-sm text-slate-600">Loading dashboard...</p> : null}
      {error ? <p className="card text-sm text-rose-700">{error}</p> : null}
      {banner ? <p className="card text-sm text-emerald-700">{banner}</p> : null}

      <div className="grid gap-4 md:grid-cols-4">
        <div className="card">
          <p className="text-sm text-slate-500">Total Students</p>
          <p className="text-2xl font-bold">{dashboard.totals?.totalStudents || 0}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">Recent Performance Updates</p>
          <p className="text-2xl font-bold">{dashboard.totals?.performanceUpdates || 0}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">Recent Attendance Updates</p>
          <p className="text-2xl font-bold">{dashboard.totals?.attendanceUpdates || 0}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">Pending Attendance (This Week)</p>
          <p className="text-2xl font-bold">{dashboard.totals?.pendingAttendanceThisWeek || 0}</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <form className="card space-y-3" onSubmit={submitPerformance}>
          <h3 className="text-lg font-semibold">Add / Update Performance</h3>

          <select
            className="input"
            value={performanceForm.studentId}
            onChange={(event) => setPerformanceForm((prev) => ({ ...prev, studentId: event.target.value }))}
            required
          >
            <option value="" disabled>
              Select Student
            </option>
            {reference.students.map((student) => (
              <option key={student._id} value={student._id}>
                {student.fullName} ({student.admissionNumber})
              </option>
            ))}
          </select>

          <select
            className="input"
            value={performanceForm.subjectId}
            onChange={(event) => setPerformanceForm((prev) => ({ ...prev, subjectId: event.target.value }))}
            required
          >
            <option value="" disabled>
              Select Subject
            </option>
            {reference.subjects.map((subject) => (
              <option key={subject._id} value={subject._id}>
                {subject.name} ({subject.code})
              </option>
            ))}
          </select>

          <select
            className="input"
            value={performanceForm.examType}
            onChange={(event) => setPerformanceForm((prev) => ({ ...prev, examType: event.target.value }))}
          >
            {examOptions.map((exam) => (
              <option key={exam} value={exam}>
                {exam}
              </option>
            ))}
          </select>

          <div className="grid grid-cols-2 gap-3">
            <input
              className="input"
              type="number"
              min={0}
              step="0.01"
              placeholder="Marks Obtained"
              value={performanceForm.marksObtained}
              onChange={(event) => setPerformanceForm((prev) => ({ ...prev, marksObtained: event.target.value }))}
              required
            />
            <input
              className="input"
              type="number"
              min={1}
              step="0.01"
              placeholder="Max Marks"
              value={performanceForm.maxMarks}
              onChange={(event) => setPerformanceForm((prev) => ({ ...prev, maxMarks: event.target.value }))}
              required
            />
          </div>

          <input
            className="input"
            type="date"
            value={performanceForm.examDate}
            onChange={(event) => setPerformanceForm((prev) => ({ ...prev, examDate: event.target.value }))}
            required
          />

          <textarea
            className="input min-h-24"
            placeholder="Remark (optional)"
            value={performanceForm.remark}
            onChange={(event) => setPerformanceForm((prev) => ({ ...prev, remark: event.target.value }))}
          />

          <button className="btn-primary w-full">Save Performance</button>
        </form>

        <form className="card space-y-3" onSubmit={submitAttendance}>
          <h3 className="text-lg font-semibold">Add / Update Attendance</h3>

          <select
            className="input"
            value={attendanceForm.studentId}
            onChange={(event) => setAttendanceForm((prev) => ({ ...prev, studentId: event.target.value }))}
            required
          >
            <option value="" disabled>
              Select Student
            </option>
            {reference.students.map((student) => (
              <option key={student._id} value={student._id}>
                {student.fullName} ({student.admissionNumber})
              </option>
            ))}
          </select>

          <input
            className="input"
            type="date"
            value={attendanceForm.date}
            onChange={(event) => setAttendanceForm((prev) => ({ ...prev, date: event.target.value }))}
            required
          />

          <select
            className="input"
            value={attendanceForm.status}
            onChange={(event) => setAttendanceForm((prev) => ({ ...prev, status: event.target.value }))}
          >
            <option value="Present">Present</option>
            <option value="Absent">Absent</option>
            <option value="Late">Late</option>
          </select>

          <textarea
            className="input min-h-24"
            placeholder="Remark (optional)"
            value={attendanceForm.remark}
            onChange={(event) => setAttendanceForm((prev) => ({ ...prev, remark: event.target.value }))}
          />

          <button className="btn-primary w-full">Save Attendance</button>

          <p className="text-xs text-slate-500">
            Need deeper analysis? Open <Link className="text-brand-700 underline" to="/teacher/progress">Student Insights</Link>.
          </p>
        </form>

        <form className="card space-y-3" onSubmit={submitActivity}>
          <h3 className="text-lg font-semibold">Extracurricular Activity</h3>

          <select
            className="input"
            value={activityForm.studentId}
            onChange={(event) => setActivityForm((prev) => ({ ...prev, studentId: event.target.value }))}
            required
          >
            <option value="" disabled>
              Select Student
            </option>
            {reference.students.map((student) => (
              <option key={student._id} value={student._id}>
                {student.fullName} ({student.admissionNumber})
              </option>
            ))}
          </select>

          <select
            className="input"
            value={activityForm.activityType}
            onChange={(event) => setActivityForm((prev) => ({ ...prev, activityType: event.target.value }))}
          >
            {activityTypeOptions.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>

          <input
            className="input"
            placeholder="Activity name (e.g., Inter-school Basketball)"
            value={activityForm.activityName}
            onChange={(event) => setActivityForm((prev) => ({ ...prev, activityName: event.target.value }))}
            required
          />

          <select
            className="input"
            value={activityForm.level}
            onChange={(event) => setActivityForm((prev) => ({ ...prev, level: event.target.value }))}
          >
            {activityLevelOptions.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>

          <input
            className="input"
            type="date"
            value={activityForm.participationDate}
            onChange={(event) => setActivityForm((prev) => ({ ...prev, participationDate: event.target.value }))}
            required
          />

          <textarea
            className="input min-h-20"
            placeholder="Remarks / achievement"
            value={activityForm.remarks}
            onChange={(event) => setActivityForm((prev) => ({ ...prev, remarks: event.target.value }))}
          />

          <div className="flex items-center gap-2">
            <button className="btn-primary flex-1" type="submit">
              {activityForm.recordId ? "Update Activity" : "Add Activity"}
            </button>
            {activityForm.recordId ? (
              <button className="btn-secondary" onClick={clearActivityEdit} type="button">
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="card">
          <h3 className="mb-3 text-lg font-semibold">Recent Performance</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="pb-2">Student</th>
                  <th className="pb-2">Subject</th>
                  <th className="pb-2">Exam</th>
                  <th className="pb-2">Score</th>
                  <th className="pb-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {(dashboard.recentPerformance || []).map((item) => (
                  <tr key={item._id} className="border-t border-slate-200 dark:border-slate-700">
                    <td className="py-2">{item.studentId?.fullName || "-"}</td>
                    <td>{item.subjectId?.name || "-"}</td>
                    <td>{item.examType}</td>
                    <td>
                      {item.marksObtained}/{item.maxMarks}
                    </td>
                    <td>{formatDate(item.examDate)}</td>
                  </tr>
                ))}
                {!dashboard.recentPerformance?.length ? (
                  <tr>
                    <td className="py-2 text-slate-500" colSpan={5}>
                      No performance records yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h3 className="mb-3 text-lg font-semibold">Recent Attendance</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="pb-2">Student</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Date</th>
                  <th className="pb-2">Remark</th>
                </tr>
              </thead>
              <tbody>
                {(dashboard.recentAttendance || []).map((item) => (
                  <tr key={item._id} className="border-t border-slate-200 dark:border-slate-700">
                    <td className="py-2">{item.studentId?.fullName || "-"}</td>
                    <td>{item.status}</td>
                    <td>{formatDate(item.date)}</td>
                    <td>{item.remark || "-"}</td>
                  </tr>
                ))}
                {!dashboard.recentAttendance?.length ? (
                  <tr>
                    <td className="py-2 text-slate-500" colSpan={4}>
                      No attendance records yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="mb-3 text-lg font-semibold">Extracurricular Activity Log</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="pb-2">Student</th>
                <th className="pb-2">Type</th>
                <th className="pb-2">Activity</th>
                <th className="pb-2">Level</th>
                <th className="pb-2">Date</th>
                <th className="pb-2">Remarks</th>
                <th className="pb-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {extracurricular.map((item) => (
                <tr key={item._id} className="border-t border-slate-200 dark:border-slate-700">
                  <td className="py-2">{item.studentId?.fullName || "-"}</td>
                  <td>{item.activityType}</td>
                  <td>{item.activityName}</td>
                  <td>{item.level}</td>
                  <td>{formatDate(item.participationDate)}</td>
                  <td>{item.remarks || "-"}</td>
                  <td>
                    <button className="btn-secondary" onClick={() => editActivity(item)} type="button">
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
              {!extracurricular.length ? (
                <tr>
                  <td className="py-2 text-slate-500" colSpan={7}>
                    No extracurricular records yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default TeacherDashboard;
