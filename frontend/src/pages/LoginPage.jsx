import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthScaffold from "../components/AuthScaffold";
import { useAuth } from "../context/AuthContext";

const demoAccounts = [
  { label: "Admin", email: "admin@gfps.edu", password: "Admin@123" },
  { label: "Teacher", email: "teacher@gfps.edu", password: "Teacher@123" },
  { label: "Student", email: "student@gfps.edu", password: "Student@123" },
  { label: "Parent", email: "parent@gfps.edu", password: "Parent@123" }
];

const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const routeByRole = (role) => {
    if (role === "owner") return "/owner";
    if (role === "admin") return "/admin";
    if (role === "teacher") return "/teacher";
    if (role === "student") return "/student";
    if (role === "parent") return "/parent";
    return "/";
  };

  const onChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const signIn = async (payload) => {
    setError("");
    setLoading(true);

    try {
      const user = await login(payload);
      navigate(routeByRole(user.role));
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    await signIn(form);
  };

  const onDemoLogin = async (account) => {
    setForm({ email: account.email, password: account.password });
    await signIn({ email: account.email, password: account.password });
  };

  return (
    <AuthScaffold
      title="Sign In"
      subtitle="Monitor marks, attendance, and AI risk insights in real time."
      hint="Owner controls school-code access from Owner Dashboard"
      footer={
        <div className="mt-3 space-y-1 text-sm">
          <p>
            New user?{" "}
            <Link to="/signup" className="text-brand-700 hover:underline">
              Create account
            </Link>
          </p>
          <p>
            <Link to="/forgot-password" className="text-brand-700 hover:underline">
              Forgot password?
            </Link>
          </p>
        </div>
      }
    >
      <form className="space-y-3" onSubmit={onSubmit}>
        <input
          className="input"
          type="email"
          name="email"
          placeholder="Email"
          value={form.email}
          onChange={onChange}
          required
        />

        <input
          className="input"
          type="password"
          name="password"
          placeholder="Password"
          value={form.password}
          onChange={onChange}
          required
        />

        {error ? <p className="rounded-xl bg-rose-50 p-2 text-sm text-rose-700">{error}</p> : null}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <div className="mt-4 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Quick Demo Login</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {demoAccounts.map((account) => (
            <button
              key={account.label}
              type="button"
              className="btn-secondary text-left"
              onClick={() => onDemoLogin(account)}
              disabled={loading}
            >
              {account.label}
            </button>
          ))}
        </div>
      </div>
    </AuthScaffold>
  );
};

export default LoginPage;


