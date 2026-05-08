import React from 'react';

const POSITIVE_WORDS = [
  { word: 'work', count: 2600 },
  { word: 'like', count: 2550 },
  { word: 'good', count: 2400 },
  { word: 'love', count: 2200 },
  { word: 'great', count: 1650 },
];

const NEGATIVE_WORDS = [
  { word: 'bad', count: 1800 },
  { word: 'issue', count: 1500 },
  { word: 'slow', count: 1200 },
  { word: 'poor', count: 900 },
  { word: 'hard', count: 500 },
];

function HorizontalBarChart({ title, data, colorClass, maxCount }) {
  return (
    <div className="flex-1 flex flex-col">
      <h3 className="text-center text-sm font-semibold text-slate-700 mb-4">{title}</h3>
      <div className="flex-1 flex flex-col gap-3 border-l border-slate-200 pl-2 pb-6 relative">
        {data.map((item, index) => {
          const widthPercentage = (item.count / maxCount) * 100;
          return (
            <div key={index} className="flex items-center gap-3 group relative h-8">
              <span className="w-10 text-right text-xs font-medium text-slate-600 truncate">
                {item.word}
              </span>
              <div className="flex-1 h-full bg-slate-50 flex items-center">
                <div 
                  className={`h-full ${colorClass} transition-all duration-300 rounded-r-sm`}
                  style={{ width: `${Math.min(widthPercentage, 100)}%` }}
                />
              </div>
              {/* Tooltip for count */}
              <div className="absolute right-0 opacity-0 group-hover:opacity-100 bg-slate-800 text-white text-[10px] py-1 px-2 rounded shadow pointer-events-none transition-opacity z-10">
                {item.count}
              </div>
            </div>
          );
        })}
        {/* X-axis approx markers */}
        <div className="absolute bottom-0 left-[60px] right-0 h-4">
          {[0, 500, 1000, 1500, 2000, 2500].map(marker => (
             <span 
               key={marker} 
               className="absolute bottom-0 text-[10px] text-slate-400 font-medium translate-x-[-50%]" 
               style={{ left: `${(marker / 2500) * 100}%` }}
             >
               {marker}
             </span>
          ))}
        </div>
      </div>
      <div className="text-center text-[10px] text-slate-500 font-medium mt-3">
        Frequency / Score Contribution
      </div>
    </div>
  );
}

export function BingWordFrequency() {
  const maxPosCount = Math.max(...POSITIVE_WORDS.map(d => d.count));
  const maxNegCount = Math.max(...NEGATIVE_WORDS.map(d => d.count));
  const maxOverallCount = Math.max(maxPosCount, maxNegCount);

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-slate-900">Word Frequency (Bing Lexicon)</h3>
        <p className="text-xs text-slate-500 mt-1">Top positive and negative words contributing to the sentiment score</p>
      </div>

      <div className="flex flex-col md:flex-row gap-10">
        <HorizontalBarChart 
          title="Top 5 Positive Words" 
          data={POSITIVE_WORDS} 
          colorClass="bg-[#38b259]" // matching the green in the screenshot
          maxCount={2500} 
        />
        <HorizontalBarChart 
          title="Top 5 Negative Words" 
          data={NEGATIVE_WORDS} 
          colorClass="bg-red-500" 
          maxCount={2500} 
        />
      </div>
    </div>
  );
}
