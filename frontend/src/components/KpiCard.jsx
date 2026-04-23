const KpiCard = ({ label, value, tone = "blue" }) => {
  const tones = {
    blue: "from-blue-100 to-cyan-100 text-blue-900 border-blue-200",
    green: "from-emerald-100 to-green-100 text-emerald-900 border-emerald-200",
    amber: "from-amber-100 to-orange-100 text-amber-900 border-amber-200",
    rose: "from-rose-100 to-pink-100 text-rose-900 border-rose-200"
  };

  return (
    <article className={`rounded-2xl border bg-gradient-to-br p-4 ${tones[tone] || tones.blue}`}>
      <p className="text-xs uppercase tracking-[0.18em] opacity-70">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </article>
  );
};

export default KpiCard;