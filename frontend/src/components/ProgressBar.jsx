const ProgressBar = ({ label, value }) => (
  <div>
    <div className="mb-1 flex justify-between text-sm">
      <span>{label}</span>
      <span>{Math.round(value)}%</span>
    </div>
    <div className="h-3 rounded-full bg-slate-200 dark:bg-slate-700">
      <div
        className="h-3 rounded-full bg-brand-500 transition-all"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  </div>
);

export default ProgressBar;
