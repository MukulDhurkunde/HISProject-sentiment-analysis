export function KPICard({ title, value, isPercentage }) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:border-indigo-200 transition-colors">
      <h3 className="text-sm font-medium text-slate-500 mb-2">{title}</h3>
      <p className={`text-3xl font-bold tracking-tight ${isPercentage ? 'text-emerald-500' : 'text-slate-900'}`}>{value}</p>
    </div>
  );
}
