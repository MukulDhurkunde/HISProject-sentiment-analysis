import React from 'react';

const HISTOGRAM_DATA = [
  { score: -5, count: 12 },
  { score: -4, count: 25 },
  { score: -3, count: 45 },
  { score: -2, count: 80 },
  { score: -1, count: 120 },
  { score: 0, count: 250 },
  { score: 1, count: 150 },
  { score: 2, count: 95 },
  { score: 3, count: 55 },
  { score: 4, count: 30 },
  { score: 5, count: 15 },
];

export function AfinnHistogram() {
  const maxCount = Math.max(...HISTOGRAM_DATA.map(d => d.count));

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
        {/* Y-axis labels */}
        <div className="h-full flex flex-col justify-between text-[10px] text-slate-400 font-medium text-right pr-3 pb-8 w-10">
          <span>{maxCount}</span>
          <span>{Math.round(maxCount / 2)}</span>
          <span>0</span>
        </div>
        
        {/* Chart Area */}
        <div className="flex-1 h-full flex flex-col">
          <div className="flex-1 flex items-end justify-between gap-1 border-b border-slate-200 relative pb-0">
            {HISTOGRAM_DATA.map((item) => {
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
          
          {/* X-axis labels */}
          <div className="flex justify-between gap-1 mt-2">
             {HISTOGRAM_DATA.map((item) => (
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
