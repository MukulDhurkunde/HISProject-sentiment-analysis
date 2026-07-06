import React, { useMemo } from 'react';
import { useDataset } from '../context/DatasetContext';

function HorizontalBarChart({ title, data, colorClass, maxCount, markers }) {
  return (
    <div className="flex-1 flex flex-col">
      <h3 className="text-center text-sm font-semibold text-slate-700 mb-4">{title}</h3>
      <div className="flex-1 flex flex-col gap-3 border-l border-slate-200 pl-2 pb-6 relative">
        {data.map((item, index) => {
          const widthPercentage = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
          return (
            <div key={index} className="flex items-center gap-3 group relative h-8">
              <span className="w-28 text-right text-xs font-medium text-slate-600 truncate" title={item.word}>
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
        <div className="absolute bottom-0 left-[132px] right-0 h-4">
          {markers.map(marker => (
             <span 
               key={marker} 
               className="absolute bottom-0 text-[10px] text-slate-400 font-medium translate-x-[-50%]" 
               style={{ left: `${maxCount > 0 ? (marker / maxCount) * 100 : 0}%` }}
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
  const { analysisResults } = useDataset();

  const bingData = analysisResults?.insights?.bing_word_freqs;

  const positiveWords = bingData?.positive ?? [];
  const negativeWords = bingData?.negative ?? [];

  const { maxCount, markers } = useMemo(() => {
    const allCounts = [
      ...positiveWords.map(d => d.count),
      ...negativeWords.map(d => d.count),
    ];

    const max = allCounts.length > 0 ? Math.max(...allCounts) : 0;

    // Generate ~5 evenly spaced markers from 0 to a nice rounded max
    const niceMax = max > 0 ? Math.ceil(max / 5) * 5 : 0;
    const step = niceMax > 0 ? niceMax / 5 : 0;
    const axisMarkers = [];
    for (let i = 0; i <= 5; i++) {
      axisMarkers.push(Math.round(step * i));
    }

    return { maxCount: niceMax || 1, markers: axisMarkers };
  }, [positiveWords, negativeWords]);

  if (!bingData) {
    return (
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-slate-900">Word Frequency (Bing Lexicon)</h3>
          <p className="text-xs text-slate-500 mt-1">Top positive and negative words contributing to the sentiment score</p>
        </div>
        <div className="flex items-center justify-center h-40 text-sm text-slate-400">
          No Bing word frequency data available
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-slate-900">Word Frequency (Bing Lexicon)</h3>
        <p className="text-xs text-slate-500 mt-1">Top positive and negative words contributing to the sentiment score</p>
      </div>

      <div className="flex flex-col md:flex-row gap-10">
        <HorizontalBarChart 
          title="Top Positive Words" 
          data={positiveWords} 
          colorClass="bg-[#38b259]"
          maxCount={maxCount}
          markers={markers}
        />
        <HorizontalBarChart 
          title="Top Negative Words" 
          data={negativeWords} 
          colorClass="bg-red-500" 
          maxCount={maxCount}
          markers={markers}
        />
      </div>
    </div>
  );
}
