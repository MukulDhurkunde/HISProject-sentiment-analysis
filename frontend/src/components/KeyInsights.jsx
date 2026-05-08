export function KeyInsights() {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-[300px] flex flex-col">
      <h3 className="text-sm font-semibold text-slate-900 mb-4">Key Insights</h3>
      <div className="flex-1 space-y-6">
        <div className="relative pl-4">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 rounded-full"></div>
          <h4 className="text-sm font-bold text-slate-900">Best performance on positive class</h4>
          <p className="text-xs text-slate-600 mt-1 leading-relaxed">Positive language uses distinctive words that are easy to classify.</p>
          <p className="text-xs text-indigo-600 font-medium mt-0.5">~91% of positive reviews were correctly identified.</p>
        </div>
        <div className="relative pl-4">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 rounded-full"></div>
          <h4 className="text-sm font-bold text-slate-900">Neutral is the hardest class</h4>
          <p className="text-xs text-slate-600 mt-1 leading-relaxed">Neutral text shares vocabulary with both polarities. This is a known NLP challenge &mdash; worth discussing in your report.</p>
        </div>
      </div>
    </div>
  );
}
