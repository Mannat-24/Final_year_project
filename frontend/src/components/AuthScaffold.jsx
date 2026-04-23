const bars = [66, 82, 74, 90, 78];

const AuthScaffold = ({ title, subtitle, hint, children, footer }) => {
  return (
    <div className="auth-shell">
      <div className="auth-glow auth-glow-1" aria-hidden="true" />
      <div className="auth-glow auth-glow-2" aria-hidden="true" />
      <div className="auth-grid">
        <aside className="auth-story">
          <p className="auth-kicker">Student Progress Tracking</p>
          <h1 className="auth-headline">Track growth, close gaps, and improve outcomes.</h1>
          <p className="auth-copy">
            A unified platform for admin, teachers, students, and parents with insights, attendance signals, and AI support.
          </p>

          <div className="auth-visual" aria-hidden="true">
            <div className="auth-bars">
              {bars.map((height, index) => (
                <span
                  className="auth-bar"
                  key={`bar-${index}`}
                  style={{ height: `${height}%`, animationDelay: `${index * 0.14}s` }}
                />
              ))}
            </div>
            <div className="auth-trend">
              <span className="auth-trend-dot" />
            </div>
          </div>

          <div className="auth-tags">
            <span>Type of Exam</span>
            <span>Result Sections</span>
            <span>Attendance</span>
            <span>AI Suggestions</span>
          </div>
        </aside>

        <section className="auth-panel card">
          <h2 className="mb-1 text-2xl font-bold">{title}</h2>
          <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">{subtitle}</p>
          {hint && <p className="mb-4 rounded-xl bg-brand-50/80 px-3 py-2 text-xs text-brand-700 dark:bg-slate-800 dark:text-brand-100">{hint}</p>}
          {children}
          {footer}
        </section>
      </div>
    </div>
  );
};

export default AuthScaffold;

