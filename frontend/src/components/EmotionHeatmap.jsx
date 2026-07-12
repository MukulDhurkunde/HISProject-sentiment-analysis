import { useDataset } from '../context/DatasetContext';

const POLARITIES = ['Positive', 'Neutral', 'Negative'];

function getHeatmapColor(value) {
  const hue = 240 - (value / 100) * 240;
  return `hsl(${hue}, 80%, 55%)`;
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function EmotionHeatmap() {
  const { analysisResults } = useDataset();

  const matrix = analysisResults?.insights?.nrc_emotion_matrix;

  if (!matrix || !matrix.emotions || !matrix.by_polarity) {
    return (
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="text-sm font-semibold text-slate-900">Emotion Heatmap (NRC Lexicon)</h3>
        <p className="text-xs text-slate-500 mt-1">Intensity correlates to numerical emotion score (Cool = Low, Warm = High)</p>
        <div className="flex items-center justify-center h-40 text-slate-400 text-sm mt-4">
          No NRC emotion data available. Upload and analyse a dataset to see results.
        </div>
      </div>
    );
  }

  const emotions = matrix.emotions;
  const byPolarity = matrix.by_polarity;

  let maxValue = 0;
  POLARITIES.forEach((polarity) => {
    const row = byPolarity[polarity];
    if (row) {
      emotions.forEach((emotion) => {
        const val = row[emotion] ?? 0;
        if (val > maxValue) maxValue = val;
      });
    }
  });

  const normalise = (val) => (maxValue > 0 ? (val / maxValue) * 100 : 0);

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-6 gap-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Emotion Heatmap (NRC Lexicon)</h3>
          <p className="text-xs text-slate-500 mt-1">Intensity correlates to numerical emotion score (Cool = Low, Warm = High)</p>
        </div>
        
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
              <th className="text-left font-semibold text-slate-600 pb-2 px-2 w-48">Polarity</th>
              {emotions.map(emotion => (
                <th key={emotion} className="font-semibold text-slate-600 pb-2 text-center w-24">
                  {capitalize(emotion)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {POLARITIES.map((polarity) => {
              const row = byPolarity[polarity];
              if (!row) return null;
              return (
                <tr key={polarity}>
                  <td className="font-medium text-slate-800 px-2 py-3 align-middle">{polarity}</td>
                  {emotions.map(emotion => {
                    const rawValue = row[emotion] ?? 0;
                    const normalisedValue = normalise(rawValue);
                    return (
                      <td key={emotion} className="p-0">
                        <div 
                          className="h-10 rounded flex items-center justify-center text-white font-bold shadow-sm transition-transform hover:scale-[1.02] cursor-default"
                          style={{ backgroundColor: getHeatmapColor(normalisedValue) }}
                          title={`${polarity} - ${capitalize(emotion)}: ${rawValue.toFixed(2)}`}
                        >
                          {rawValue.toFixed(2)}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
