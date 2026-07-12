import React, { useMemo } from 'react';
import { useDataset } from '../context/DatasetContext';

export function AfinnHistogram() {
  const { analysisResults } = useDataset();

  const histogramData = useMemo(() => {
    if (!analysisResults?.processed_rows) return null;

    const bins = {};
    for (let s = -5; s <= 5; s++) bins[s] = 0;

    analysisResults.processed_rows.forEach((row) => {
      const raw = row.sentiment_score;
      if (raw == null || Number.isNaN(Number(raw))) return;
      const rounded = Math.round(Number(raw));
      const clamped = Math.max(-5, Math.min(5, rounded));
      bins[clamped] += 1;
    });

    return Array.from({ length: 11 }, (_, i) => {
      const score = i - 5;
      return { score, count: bins[score] };
    });
  }, [analysisResults]);

  if (!histogramData) {
    return (
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-slate-900">Polarity Histogram (AFINN Lexicon)</h3>
          <p className="text-xs text-slate-500 mt-1">Word count distribution by sentiment score (-5 to +5)</p>
        </div>
        <div className="flex items-center justify-center h-[250px] text-sm text-slate-400">
          No analysis data available. Upload and analyse a dataset to view the histogram.
        </div>
      </div>
    );
  }

  const maxCount = Math.max(...histogramData.map((d) => d.count), 1);

  const getColor = (score) => {
    if (score < 0) return 'bg-red-400';
    if (score === 0) return 'bg-slate-300';
    return 'bg-green-400';
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-slate-900">Polarity Histogram (AFINN Lexicon)</h3>
        <p className="text-xs text-slate-500 mt-1">Word count distribution by sentiment score (-5 to +5)</p>
      </div>

      <div className="flex items-start h-[250px]">
        <div className="h-full flex flex-col justify-between text-[10px] text-slate-400 font-medium text-right pr-3 pb-8 w-10">
          <span>{maxCount}</span>
          <span>{Math.round(maxCount / 2)}</span>
          <span>0</span>
        </div>
        
        <div className="flex-1 h-full flex flex-col">
          <div className="flex-1 flex items-end justify-between gap-1 border-b border-slate-200 relative pb-0">
            {histogramData.map((item) => {
              const heightPercentage = Math.max((item.count / maxCount) * 100, 1);
              return (
                <div key={item.score} className="flex flex-col items-center flex-1 h-full justify-end group">
                  <div 
                    className={`w-[80%] rounded-t-sm transition-all duration-300 hover:opacity-80 ${getColor(item.score)} relative`}
                    style={{ height: `${heightPercentage}%` }}
                  >
                     <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] py-1 px-2 rounded shadow pointer-events-none transition-opacity whitespace-nowrap z-10">
                       Count: {item.count}
                     </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          <div className="flex justify-between gap-1 mt-2">
             {histogramData.map((item) => (
                <div key={item.score} className="flex-1 text-center text-xs font-semibold text-slate-600">
                  {item.score > 0 ? `+${item.score}` : item.score}
                </div>
             ))}
          </div>
        </div>
      </div>

      <div className="mt-4 flex justify-center gap-6 text-xs text-slate-500 font-medium">
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-red-400" />Negative (-5 to -1)</div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-slate-300" />Neutral (0)</div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-green-400" />Positive (+1 to +5)</div>
      </div>
    </div>
  );
}
