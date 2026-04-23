import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthScaffold from "../components/AuthScaffold";
import { useAuth } from "../context/AuthContext";

const SignupPage = () => {
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
  const { signup } = useAuth();
  const navigate = useNavigate();

  const onChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const payload = {
        fullName: form.fullName,
        email: form.email,
        password: form.password,
        role: form.role,
        schoolCode: form.schoolCode.trim().toUpperCase()
      };

      if (form.role === "student") {
        payload.admissionNumber = form.admissionNumber.trim();
        payload.grade = form.grade.trim() || "NA";
        payload.section = form.section.trim() || "A";
      }

      if (form.role === "parent" && form.childAdmissionNumbers.trim()) {
        payload.childAdmissionNumbers = form.childAdmissionNumbers
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
      }

      await signup(payload);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScaffold
      title="Create Account"
      subtitle="Register as Admin, Teacher, Student, or Parent for your school."
      hint="Use your school code. Example seed school code: GFPS01"
      footer={
        <p className="mt-3 text-sm">
          Already registered?{" "}
          <Link className="text-brand-700 hover:underline" to="/login">
            Login
          </Link>
        </p>
      }
    >
      {error && <p className="mb-3 rounded-xl bg-red-100 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">{error}</p>}
      <form className="space-y-3" onSubmit={submit}>
        <input className="input" placeholder="Full Name" value={form.fullName} onChange={(e) => onChange("fullName", e.target.value)} required />

        <select className="input" value={form.role} onChange={(e) => onChange("role", e.target.value)}>
          <option value="admin">Admin</option>
          <option value="teacher">Teacher</option>
          <option value="student">Student</option>
          <option value="parent">Parent</option>
        </select>

        <input className="input" type="email" placeholder="Email" value={form.email} onChange={(e) => onChange("email", e.target.value)} required />
        <input className="input" type="password" placeholder="Password" minLength={8} value={form.password} onChange={(e) => onChange("password", e.target.value)} required />
        <input className="input" placeholder="School Code" value={form.schoolCode} onChange={(e) => onChange("schoolCode", e.target.value.toUpperCase())} required />

        {form.role === "student" && (
          <>
            <input className="input" placeholder="Admission Number" value={form.admissionNumber} onChange={(e) => onChange("admissionNumber", e.target.value)} required />
            <div className="grid grid-cols-2 gap-3">
              <input className="input" placeholder="Grade" value={form.grade} onChange={(e) => onChange("grade", e.target.value)} required />
              <input className="input" placeholder="Section" value={form.section} onChange={(e) => onChange("section", e.target.value.toUpperCase())} />
            </div>
          </>
        )}

        {form.role === "parent" && (
          <input
            className="input"
            placeholder="Child Admission Numbers (comma-separated)"
            value={form.childAdmissionNumbers}
            onChange={(e) => onChange("childAdmissionNumbers", e.target.value)}
          />
        )}

        <button className="btn-primary w-full" disabled={loading}>
          {loading ? "Creating account..." : "Create Account"}
        </button>
      </form>
    </AuthScaffold>
  );
};

export default SignupPage;
