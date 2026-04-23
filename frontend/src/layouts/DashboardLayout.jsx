import { Link, useLocation, useNavigate } from "react-router-dom";
import AiChatWidget from "../components/AiChatWidget";
import Avatar from "../components/Avatar";
import ThemeToggle from "../components/ThemeToggle";
import { useAuth } from "../context/AuthContext";

const navByRole = {
  owner: [{ to: "/owner", label: "Owner Dashboard" }],
  admin: [{ to: "/admin", label: "Admin Dashboard" }],
  teacher: [
    { to: "/teacher", label: "Teacher Dashboard" },
    { to: "/teacher/progress", label: "Student Insights" },
    { to: "/teacher/timetable", label: "Time table" }
  ],
  student: [
    { to: "/student", label: "Student Dashboard" },
    { to: "/student/timetable", label: "Time table" }
  ],
  parent: [{ to: "/parent", label: "Parent Dashboard" }]
};

const DashboardLayout = ({ title, children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const onLogout = () => {
    logout();
    navigate("/login");
  };

  const navItems = navByRole[user?.role] || [];

  return (
    <div className="min-h-screen p-3 pb-16 md:p-5">
      <div className="mx-auto grid max-w-[1500px] gap-4 md:grid-cols-[280px_1fr]">
        <aside className="card h-fit md:sticky md:top-5 md:h-[calc(100vh-2.5rem)] md:overflow-y-auto">
          <div className="mb-5 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700 dark:text-cyan-300">Student Track Pro</p>
            <div className="flex items-center gap-3 rounded-xl bg-slate-100/70 p-3 dark:bg-slate-800/80">
              <Avatar name={user?.fullName} size="md" />
              <div>
                <p className="text-sm font-semibold">{user?.fullName || "User"}</p>
                {user?.role !== "owner" ? (
                  <p className="text-xs uppercase text-slate-500 dark:text-slate-300">{user?.role}</p>
                ) : null}
                <p className="text-xs text-slate-500 dark:text-slate-300">{user?.email}</p>
              </div>
            </div>
          </div>

          <nav className="space-y-2">
            {navItems.map((item) => {
              const active = location.pathname === item.to;
              return (
                <Link key={item.to} to={item.to} className={`sidebar-link ${active ? "active" : "inactive"}`}>
                  {item.label}
                </Link>
              );
            })}
            <Link to="/" className="sidebar-link inactive">
              Home
            </Link>
          </nav>

          <div className="mt-6 flex flex-col gap-2">
            <button className="btn-secondary" onClick={onLogout}>
              Logout
            </button>
          </div>
        </aside>

        <main className="space-y-4">
          <header className="card bg-gradient-to-r from-brand-500 to-cyan-600 text-white dark:border-slate-700">
            <h1 className="text-2xl font-bold">{title}</h1>
            <p className="text-sm text-white/90">Role-based analytics and progress management panel</p>
          </header>
          {children}
        </main>
      </div>

      <ThemeToggle />
      <AiChatWidget />
    </div>
  );
};

export default DashboardLayout;
