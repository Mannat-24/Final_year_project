import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const roleOptions = ["admin", "teacher", "student", "parent"];

const RegisterPage = () => {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    role: "student",
    schoolCode: "",
    admissionNumber: "",
    grade: "",
    section: "A",
    childAdmissionNumbers: ""
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const payload = useMemo(() => {
    const base = {
      fullName: form.fullName,
      email: form.email,
      password: form.password,
      role: form.role,
      schoolCode: form.schoolCode
    };

    if (form.role === "student") {
      base.admissionNumber = form.admissionNumber;
      base.grade = form.grade;
      base.section = form.section;
    }

    if (form.role === "parent" && form.childAdmissionNumbers.trim()) {
      base.childAdmissionNumbers = form.childAdmissionNumbers
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }

    return base;
  }, [form]);

  const onChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const user = await register(payload);
      if (user.role === "admin") navigate("/admin");
      if (user.role === "teacher") navigate("/teacher");
      if (user.role === "student") navigate("/student");
      if (user.role === "parent") navigate("/parent");
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-bg flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl rounded-3xl border border-cyan-100 bg-white/95 p-6 shadow-2xl shadow-cyan-100/70">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-600">SPT Platform</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Register</h1>

        <form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
          <label className="block md:col-span-2">
            <span className="mb-1 block text-sm font-medium text-slate-700">Full name</span>
            <input
              className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-cyan-500"
              name="fullName"
              value={form.fullName}
              onChange={onChange}
              required
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Email</span>
            <input
              className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-cyan-500"
              type="email"
              name="email"
              value={form.email}
              onChange={onChange}
              required
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Password</span>
            <input
              className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-cyan-500"
              type="password"
              name="password"
              value={form.password}
              onChange={onChange}
              minLength={8}
              required
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Role</span>
            <select
              className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-cyan-500"
              name="role"
              value={form.role}
              onChange={onChange}
            >
              {roleOptions.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">School code</span>
            <input
              className="w-full rounded-xl border border-slate-300 px-3 py-2 uppercase outline-none focus:border-cyan-500"
              name="schoolCode"
              value={form.schoolCode}
              onChange={onChange}
              required
            />
          </label>

          {form.role === "student" ? (
            <>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Admission number</span>
                <input
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-cyan-500"
                  name="admissionNumber"
                  value={form.admissionNumber}
                  onChange={onChange}
                  required
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Grade</span>
                <input
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-cyan-500"
                  name="grade"
                  value={form.grade}
                  onChange={onChange}
                  required
                />
              </label>
            </>
          ) : null}

          {form.role === "parent" ? (
            <label className="block md:col-span-2">
              <span className="mb-1 block text-sm font-medium text-slate-700">Child admission numbers (comma separated)</span>
              <input
                className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-cyan-500"
                name="childAdmissionNumbers"
                value={form.childAdmissionNumbers}
                onChange={onChange}
              />
            </label>
          ) : null}

          {error ? <p className="rounded-xl bg-rose-50 p-2 text-sm text-rose-700 md:col-span-2">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-cyan-600 px-4 py-2 font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-70 md:col-span-2"
          >
            {loading ? "Creating account..." : "Register"}
          </button>
        </form>

        <p className="mt-4 text-sm text-slate-600">
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-cyan-700 hover:text-cyan-600">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;