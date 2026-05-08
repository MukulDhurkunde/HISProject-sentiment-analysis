const HEATMAP_DATA = [
  { topic: 'Product Features', scores: { Joy: 85, Anger: 15, Sadness: 5, Fear: 10, Trust: 75 } },
  { topic: 'Customer Support', scores: { Joy: 65, Anger: 20, Sadness: 15, Fear: 5, Trust: 90 } },
  { topic: 'Pricing & Billing', scores: { Joy: 10, Anger: 75, Sadness: 45, Fear: 30, Trust: 20 } },
  { topic: 'Mobile App', scores: { Joy: 25, Anger: 60, Sadness: 35, Fear: 20, Trust: 40 } },
  { topic: 'Reliability', scores: { Joy: 55, Anger: 30, Sadness: 10, Fear: 40, Trust: 60 } },
];

const EMOTIONS = ['Joy', 'Anger', 'Sadness', 'Fear', 'Trust'];

// Helper to generate a background color from blue (cool) to red (warm)
function getHeatmapColor(value) {
  // Map 0-100 to Hue 240 (Blue) down to 0 (Red)
  const hue = 240 - (value / 100) * 240;
  return `hsl(${hue}, 80%, 55%)`;
}

export function EmotionHeatmap() {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-6 gap-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Emotion Heatmap (NRC Lexicon)</h3>
          <p className="text-xs text-slate-500 mt-1">Intensity correlates to numerical emotion score (Cool = Low, Warm = High)</p>
        </div>
        
        {/* Legend */}
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
          <span>Cool (0)</span>
          <div className="w-48 h-2.5 rounded-full" style={{ background: 'linear-gradient(to right, hsl(240,80%,55%), hsl(180,80%,55%), hsl(120,80%,55%), hsl(60,80%,55%), hsl(0,80%,55%))' }}></div>
          <span>Warm (100)</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-separate border-spacing-y-2 border-spacing-x-2">
          <thead>
            <tr>
              <th className="text-left font-semibold text-slate-600 pb-2 px-2 w-48">Topic Focus</th>
              {EMOTIONS.map(emotion => (
                <th key={emotion} className="font-semibold text-slate-600 pb-2 text-center w-24">
                  {emotion}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {HEATMAP_DATA.map((row) => (
              <tr key={row.topic}>
                <td className="font-medium text-slate-800 px-2 py-3 align-middle">{row.topic}</td>
                {EMOTIONS.map(emotion => {
                  const score = row.scores[emotion];
                  return (
                    <td key={emotion} className="p-0">
                      <div 
                        className="h-10 rounded flex items-center justify-center text-white font-bold shadow-sm transition-transform hover:scale-[1.02] cursor-default"
                        style={{ backgroundColor: getHeatmapColor(score) }}
                        title={`${row.topic} - ${emotion}: ${score}`}
                      >
                        {score}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
