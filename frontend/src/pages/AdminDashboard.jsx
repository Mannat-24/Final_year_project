import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import client from "../api/client";
import DashboardLayout from "../layouts/DashboardLayout";
import KpiCard from "../components/KpiCard";

const AdminDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [banner, setBanner] = useState("");

  const [schoolProfile, setSchoolProfile] = useState({
    school: null,
    summary: { admins: 0, teachers: 0, students: 0, parents: 0, studentProfiles: 0, subjects: 0, totalUsers: 0 }
  });

  const [analytics, setAnalytics] = useState({
    subjectAverages: [],
    attendancePercentage: 0,
    performanceTrend: [],
    userBreakdown: [],
    classAttendance: []
  });

  const [studentsPage, setStudentsPage] = useState(1);
  const [teachersPage, setTeachersPage] = useState(1);

  const [studentsView, setStudentsView] = useState({
    items: [],
    meta: { page: 1, totalPages: 1, total: 0, limit: 12 }
  });
  const [teachersView, setTeachersView] = useState({
    items: [],
    meta: { page: 1, totalPages: 1, total: 0, limit: 12 }
  });

  const [subjects, setSubjects] = useState([]);
  const [classOptions, setClassOptions] = useState([]);

  const [riskGrade, setRiskGrade] = useState("");
  const [riskSection, setRiskSection] = useState("");
  const [riskStudents, setRiskStudents] = useState([]);
  const [riskStudentId, setRiskStudentId] = useState("");
  const [riskData, setRiskData] = useState(null);
  const [riskLoading, setRiskLoading] = useState(false);

  const [studentForm, setStudentForm] = useState({
    fullName: "",
    admissionNumber: "",
    grade: "",
    section: "A"
  });
  const [userForm, setUserForm] = useState({
    fullName: "",
    email: "",
    password: "",
    role: "teacher"
  });
  const [subjectForm, setSubjectForm] = useState({ name: "", code: "" });

  const classAverageAttendance = useMemo(() => {
    const classes = analytics.classAttendance || [];
    if (!classes.length) return Number(analytics.attendancePercentage || 0);

    const avg = classes.reduce((sum, item) => sum + Number(item.attendancePercentage || 0), 0) / classes.length;
    return Number(avg.toFixed(2));
  }, [analytics]);

  const gradeOptions = useMemo(
    () => [...new Set((classOptions || []).map((item) => String(item.grade || "")))].filter(Boolean),
    [classOptions]
  );

  const sectionOptions = useMemo(
    () =>
      [...new Set((classOptions || [])
        .filter((item) => String(item.grade || "") === String(riskGrade || ""))
        .map((item) => String(item.section || "")))]
        .filter(Boolean),
    [classOptions, riskGrade]
  );

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [schoolRes, analyticsRes, studentsRes, teachersRes, subjectsRes, classRes] = await Promise.all([
        client.get("/admin/school"),
        client.get("/admin/analytics"),
        client.get("/admin/students", { params: { page: studentsPage, limit: 12 } }),
        client.get("/admin/users", { params: { role: "teacher", page: teachersPage, limit: 12 } }),
        client.get("/admin/subjects"),
        client.get("/admin/student-classes")
      ]);

      setSchoolProfile(schoolRes.data);
      setAnalytics(analyticsRes.data);
      setStudentsView({
        items: studentsRes.data.items || [],
        meta: studentsRes.data.meta || { page: studentsPage, totalPages: 1, total: 0, limit: 12 }
      });
      setTeachersView({
        items: teachersRes.data.items || [],
        meta: teachersRes.data.meta || { page: teachersPage, totalPages: 1, total: 0, limit: 12 }
      });
      setSubjects(subjectsRes.data.items || []);
      setClassOptions(classRes.data.items || []);

      const firstClass = classRes.data.items?.[0];
      if (firstClass) {
        setRiskGrade((prev) => prev || String(firstClass.grade || ""));
        setRiskSection((prev) => prev || String(firstClass.section || ""));
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load admin dashboard");
    } finally {
      setLoading(false);
    }
  }, [studentsPage, teachersPage]);

  const loadRiskStudents = useCallback(async () => {
    if (!riskGrade || !riskSection) {
      setRiskStudents([]);
      setRiskStudentId("");
      return;
    }

    try {
      const { data } = await client.get("/admin/students", {
        params: {
          grade: riskGrade,
          section: riskSection,
          page: 1,
          limit: 500
        }
      });

      const items = data.items || [];
      setRiskStudents(items);

      setRiskStudentId((prev) => {
        if (items.some((item) => String(item._id) === String(prev))) {
          return prev;
        }
        return items[0]?._id || "";
      });
    } catch (err) {
      setRiskStudents([]);
      setRiskStudentId("");
      setError(err.response?.data?.message || "Unable to load students for selected class");
    }
  }, [riskGrade, riskSection]);

  const loadRisk = useCallback(async () => {
    if (!riskStudentId) {
      setRiskData(null);
      return;
    }

    setRiskLoading(true);

    try {
      const { data } = await client.get(`/ml/predict/student/${riskStudentId}`);
      setRiskData(data);
    } catch (err) {
      setRiskData(null);
      setError(err.response?.data?.message || "Unable to load risk prediction");
    } finally {
      setRiskLoading(false);
    }
  }, [riskStudentId]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (!riskGrade || !sectionOptions.length) return;

    if (!sectionOptions.includes(String(riskSection || ""))) {
      setRiskSection(sectionOptions[0]);
    }
  }, [riskGrade, riskSection, sectionOptions]);

  useEffect(() => {
    loadRiskStudents().catch(() => {});
  }, [loadRiskStudents]);

  useEffect(() => {
    loadRisk().catch(() => {});
  }, [loadRisk]);

  const onStudentSubmit = async (event) => {
    event.preventDefault();
    setBanner("");

    try {
      await client.post("/admin/students", studentForm);
      setBanner("Student profile created");
      setStudentForm({ fullName: "", admissionNumber: "", grade: "", section: "A" });
      await loadDashboard();
    } catch (err) {
      setBanner(err.response?.data?.message || "Unable to create student");
    }
  };

  const onUserSubmit = async (event) => {
    event.preventDefault();
    setBanner("");

    try {
      await client.post("/admin/users", userForm);
      setBanner("User created successfully");
      setUserForm({ fullName: "", email: "", password: "", role: "teacher" });
      await loadDashboard();
    } catch (err) {
      setBanner(err.response?.data?.message || "Unable to create user");
    }
  };

  const onSubjectSubmit = async (event) => {
    event.preventDefault();
    setBanner("");

    try {
      await client.post("/admin/subjects", subjectForm);
      setBanner("Subject added");
      setSubjectForm({ name: "", code: "" });
      await loadDashboard();
    } catch (err) {
      setBanner(err.response?.data?.message || "Unable to add subject");
    }
  };

  const formInputClass = "input";

  return (
    <DashboardLayout title="Admin School Dashboard">
      {loading ? <p className="text-sm text-slate-600">Loading admin dashboard...</p> : null}
      {error ? <p className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
      {banner ? <p className="mb-4 rounded-xl bg-cyan-50 p-3 text-sm text-cyan-700">{banner}</p> : null}

      <section className="card mb-4">
        <h3 className="text-lg font-semibold">School Scope</h3>
        <p className="text-sm text-slate-600">{schoolProfile.school?.name || "-"} ({schoolProfile.school?.code || "-"})</p>
        <p className="text-xs text-slate-500">Admin access is restricted to this school only.</p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Registered Students" value={schoolProfile.summary?.students || 0} tone="blue" />
        <KpiCard label="Registered Teachers" value={schoolProfile.summary?.teachers || 0} tone="green" />
        <KpiCard label="Class Avg Attendance" value={`${classAverageAttendance}%`} tone="amber" />
        <KpiCard label="Subjects" value={schoolProfile.summary?.subjects || subjects.length} tone="rose" />
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-2">
        <article className="card">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-600">Average Marks by Subject</h3>
          <div className="mt-3 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.subjectAverages || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="subjectName" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="averageMarks" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="card">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-600">Performance Trend</h3>
          <div className="mt-3 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics.performanceTrend || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Line type="monotone" dataKey="avgScore" stroke="#14b8a6" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[2fr_1fr]">
        <article className="card">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-600">Class-wise Attendance Average</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2">Class</th>
                  <th className="py-2">Attendance %</th>
                  <th className="py-2">Total Records</th>
                  <th className="py-2">Absences</th>
                </tr>
              </thead>
              <tbody>
                {(analytics.classAttendance || []).map((item) => (
                  <tr key={`${item.className}-${item.totalRecords}`} className="border-b border-slate-100">
                    <td className="py-2 font-medium text-slate-800">{item.className}</td>
                    <td className="py-2">{item.attendancePercentage}%</td>
                    <td className="py-2">{item.totalRecords}</td>
                    <td className="py-2">{item.absent}</td>
                  </tr>
                ))}
                {!analytics.classAttendance?.length ? (
                  <tr>
                    <td className="py-2 text-slate-500" colSpan={4}>No class attendance data available.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>

        <article className="card">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-600">Role Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={analytics.userBreakdown || []} dataKey="count" nameKey="role" cx="50%" cy="50%" outerRadius={90} fill="#0284c7" label />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>

      <section className="mt-6 card">
        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-600">ML Risk Prediction Panel</h3>

        <div className="mt-3 grid gap-3 md:grid-cols-[180px_180px_1fr_auto]">
          <select className={formInputClass} value={riskGrade} onChange={(e) => setRiskGrade(e.target.value)}>
            {gradeOptions.map((grade) => (
              <option key={grade} value={grade}>
                Grade {grade}
              </option>
            ))}
          </select>

          <select className={formInputClass} value={riskSection} onChange={(e) => setRiskSection(e.target.value)}>
            {sectionOptions.map((section) => (
              <option key={section} value={section}>
                Section {section}
              </option>
            ))}
          </select>

          <select className={formInputClass} value={riskStudentId} onChange={(e) => setRiskStudentId(e.target.value)}>
            {(riskStudents || []).map((student) => (
              <option key={student._id} value={student._id}>
                {student.fullName} ({student.admissionNumber})
              </option>
            ))}
          </select>

          <button className="rounded-xl bg-cyan-600 px-3 py-2 text-sm font-semibold text-white" onClick={() => loadRisk().catch(() => {})}>
            Refresh Prediction
          </button>
        </div>

        {riskLoading ? <p className="mt-3 text-sm text-slate-500">Loading prediction...</p> : null}

        {riskData ? (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2">Student</th>
                  <th className="py-2">Risk</th>
                  <th className="py-2">Avg Marks</th>
                  <th className="py-2">Attendance</th>
                  <th className="py-2">Past Performance</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-100">
                  <td className="py-2">{riskData.studentName}</td>
                  <td className="py-2 font-semibold">{riskData.riskLevel}</td>
                  <td className="py-2">{riskData.features?.marks ?? "-"}</td>
                  <td className="py-2">{riskData.features?.attendance ?? "-"}</td>
                  <td className="py-2">{riskData.features?.pastPerformance ?? "-"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <form onSubmit={onStudentSubmit} className="card">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-600">Create Student Profile</h3>
          <div className="mt-3 grid gap-3">
            <input className={formInputClass} placeholder="Student full name" value={studentForm.fullName} onChange={(e) => setStudentForm((prev) => ({ ...prev, fullName: e.target.value }))} required />
            <input className={formInputClass} placeholder="Admission number" value={studentForm.admissionNumber} onChange={(e) => setStudentForm((prev) => ({ ...prev, admissionNumber: e.target.value }))} required />
            <input className={formInputClass} placeholder="Grade" value={studentForm.grade} onChange={(e) => setStudentForm((prev) => ({ ...prev, grade: e.target.value }))} required />
            <input className={formInputClass} placeholder="Section" value={studentForm.section} onChange={(e) => setStudentForm((prev) => ({ ...prev, section: e.target.value }))} />
            <button className="rounded-xl bg-cyan-600 px-3 py-2 text-sm font-semibold text-white">Add student</button>
          </div>
        </form>

        <form onSubmit={onUserSubmit} className="card">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-600">Create Teacher / Parent / Admin</h3>
          <div className="mt-3 grid gap-3">
            <input className={formInputClass} placeholder="Full name" value={userForm.fullName} onChange={(e) => setUserForm((prev) => ({ ...prev, fullName: e.target.value }))} required />
            <input className={formInputClass} placeholder="Email" type="email" value={userForm.email} onChange={(e) => setUserForm((prev) => ({ ...prev, email: e.target.value }))} required />
            <input className={formInputClass} placeholder="Password" type="password" value={userForm.password} onChange={(e) => setUserForm((prev) => ({ ...prev, password: e.target.value }))} minLength={8} required />
            <select className={formInputClass} value={userForm.role} onChange={(e) => setUserForm((prev) => ({ ...prev, role: e.target.value }))}>
              <option value="teacher">Teacher</option>
              <option value="parent">Parent</option>
              <option value="admin">Admin</option>
            </select>
            <button className="rounded-xl bg-cyan-600 px-3 py-2 text-sm font-semibold text-white">Create user</button>
          </div>
        </form>

        <form onSubmit={onSubjectSubmit} className="card">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-600">Create Subject</h3>
          <div className="mt-3 grid gap-3">
            <input className={formInputClass} placeholder="Subject name" value={subjectForm.name} onChange={(e) => setSubjectForm((prev) => ({ ...prev, name: e.target.value }))} required />
            <input className={formInputClass} placeholder="Subject code" value={subjectForm.code} onChange={(e) => setSubjectForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))} required />
            <button className="rounded-xl bg-cyan-600 px-3 py-2 text-sm font-semibold text-white">Add subject</button>
          </div>
        </form>
      </section>

      <section className="mt-6 card">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-600">All Registered Students</h3>
          <p className="text-xs text-slate-500">Total: {studentsView.meta?.total || 0}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="py-2">Name</th>
                <th className="py-2">Admission No.</th>
                <th className="py-2">Class</th>
                <th className="py-2">Parent Links</th>
                <th className="py-2">Teacher Links</th>
              </tr>
            </thead>
            <tbody>
              {(studentsView.items || []).map((item) => (
                <tr key={item._id} className="border-b border-slate-100">
                  <td className="py-2 font-medium text-slate-800">{item.fullName}</td>
                  <td className="py-2">{item.admissionNumber}</td>
                  <td className="py-2">{item.grade}-{item.section}</td>
                  <td className="py-2">{item.parentUserIds?.length || 0}</td>
                  <td className="py-2">{item.teacherUserIds?.length || 0}</td>
                </tr>
              ))}
              {!studentsView.items?.length ? (
                <tr>
                  <td className="py-2 text-slate-500" colSpan={5}>No student records found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            className="rounded-lg border border-slate-300 px-3 py-1 text-sm"
            disabled={(studentsView.meta?.page || 1) <= 1}
            onClick={() => setStudentsPage((prev) => Math.max(1, prev - 1))}
          >
            Previous
          </button>
          <span className="text-xs text-slate-500">
            Page {studentsView.meta?.page || 1} of {studentsView.meta?.totalPages || 1}
          </span>
          <button
            className="rounded-lg border border-slate-300 px-3 py-1 text-sm"
            disabled={(studentsView.meta?.page || 1) >= (studentsView.meta?.totalPages || 1)}
            onClick={() => setStudentsPage((prev) => prev + 1)}
          >
            Next
          </button>
        </div>
      </section>

      <section className="mt-6 card">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-600">All Registered Teachers</h3>
          <p className="text-xs text-slate-500">Total: {teachersView.meta?.total || 0}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="py-2">Name</th>
                <th className="py-2">Email</th>
                <th className="py-2">Status</th>
                <th className="py-2">Joined</th>
              </tr>
            </thead>
            <tbody>
              {(teachersView.items || []).map((item) => (
                <tr key={item._id} className="border-b border-slate-100">
                  <td className="py-2 font-medium text-slate-800">{item.fullName}</td>
                  <td className="py-2">{item.email}</td>
                  <td className="py-2">{item.isActive ? "Active" : "Inactive"}</td>
                  <td className="py-2">{new Date(item.createdAt).toLocaleDateString("en-IN")}</td>
                </tr>
              ))}
              {!teachersView.items?.length ? (
                <tr>
                  <td className="py-2 text-slate-500" colSpan={4}>No teacher records found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            className="rounded-lg border border-slate-300 px-3 py-1 text-sm"
            disabled={(teachersView.meta?.page || 1) <= 1}
            onClick={() => setTeachersPage((prev) => Math.max(1, prev - 1))}
          >
            Previous
          </button>
          <span className="text-xs text-slate-500">
            Page {teachersView.meta?.page || 1} of {teachersView.meta?.totalPages || 1}
          </span>
          <button
            className="rounded-lg border border-slate-300 px-3 py-1 text-sm"
            disabled={(teachersView.meta?.page || 1) >= (teachersView.meta?.totalPages || 1)}
            onClick={() => setTeachersPage((prev) => prev + 1)}
          >
            Next
          </button>
        </div>
      </section>
    </DashboardLayout>
  );
};

export default AdminDashboard;
