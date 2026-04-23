const StatCard = ({ label, value }) => (
  <div className="card">
    <p className="text-sm text-slate-500 dark:text-slate-300">{label}</p>
    <h3 className="text-2xl font-bold">{value}</h3>
  </div>
);

export default StatCard;
