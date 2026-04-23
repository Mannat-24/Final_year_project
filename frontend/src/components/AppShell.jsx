import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const roleLanding = {
  admin: "/admin",
  teacher: "/teacher",
  student: "/student",
  parent: "/parent"
};

const linksByRole = {
  admin: [{ label: "Admin Dashboard", to: "/admin" }],
  teacher: [{ label: "Teacher Dashboard", to: "/teacher" }],
  student: [{ label: "Student Dashboard", to: "/student" }],
  parent: [{ label: "Parent Dashboard", to: "/parent" }]
};

const AppShell = ({ title, children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const roleLinks = user ? linksByRole[user.role] || [] : [];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#e0f2fe,_#f8fafc_45%,_#ecfeff)] text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 py-6 lg:flex-row lg:px-6">
        <aside className="w-full rounded-3xl border border-cyan-100 bg-white/90 p-4 shadow-xl shadow-cyan-100/60 lg:w-72 lg:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-600">SPT</p>
          <h1 className="mt-2 text-xl font-bold text-slate-900">Real-Time Student Tracking</h1>
          {user ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm">
              <p className="font-semibold">{user.fullName}</p>
              <p className="text-slate-600">{user.email}</p>
              <p className="mt-1 inline-block rounded-full bg-cyan-100 px-2 py-0.5 text-xs font-semibold text-cyan-700">
                {user.role}
              </p>
            </div>
          ) : null}

          <nav className="mt-5 space-y-2">
            {roleLinks.map((link) => {
              const active = location.pathname === link.to;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`block rounded-xl px-3 py-2 text-sm font-medium transition ${
                    active
                      ? "bg-cyan-600 text-white"
                      : "bg-cyan-50 text-cyan-700 hover:bg-cyan-100"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-6 flex gap-2">
            {user ? (
              <Link
                to={roleLanding[user.role] || "/"}
                className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600"
              >
                Home
              </Link>
            ) : null}
            <button
              type="button"
              onClick={logout}
              className="rounded-xl bg-amber-500 px-3 py-2 text-xs font-semibold text-amber-950 hover:bg-amber-400"
            >
              Logout
            </button>
          </div>
        </aside>

        <main className="flex-1 rounded-3xl border border-white/80 bg-white/80 p-4 shadow-lg shadow-slate-200/70 backdrop-blur-sm lg:p-6">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
            <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-medium text-cyan-700">
              Latency target under 3s via Socket.io
            </span>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
};

export default AppShell;