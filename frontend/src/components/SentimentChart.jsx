import { useMemo } from 'react';
import { useDataset } from '../context/DatasetContext';
import { BookOpen, AlertTriangle } from 'lucide-react';

function describeArc(cx, cy, r, startPercent, endPercent) {
  if (endPercent - startPercent === 100) endPercent -= 0.001;
  const startAngle = (startPercent / 100) * 360 - 90;
  const endAngle   = (endPercent   / 100) * 360 - 90;
  const startRad   = (startAngle * Math.PI) / 180;
  const endRad     = (endAngle   * Math.PI) / 180;
  const x1 = cx + r * Math.cos(startRad);
  const y1 = cy + r * Math.sin(startRad);
  const x2 = cx + r * Math.cos(endRad);
  const y2 = cy + r * Math.sin(endRad);
  const largeArc = endPercent - startPercent > 50 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
}

const COLORS = {
  Positive: '#22c55e',
  Neutral:  '#94a3b8',
  Negative: '#ef4444',
};

export function SentimentChart({ selectedSentiment, onSentimentClick, showMislabeled, onMislabeledClick }) {
  const { analysisResults } = useDataset();
  const cx = 18, cy = 18, radius = 14;

  const hasOriginalLabels = useMemo(() =>
    analysisResults?.processed_rows?.some(row => row.original_sentiment_label),
    [analysisResults]
  );

  const flaggedCount = useMemo(() => {
    if (!analysisResults?.processed_rows) return 0;
    return analysisResults.processed_rows.filter(r =>
      r.original_sentiment_label &&
      r.ml_sentiment_label &&
      r.sentiment_label &&
      r.ml_sentiment_label !== r.original_sentiment_label &&
      r.sentiment_label !== r.original_sentiment_label
    ).length;
  }, [analysisResults]);

  const { segments, majoritySentiment } = useMemo(() => {
    if (!analysisResults?.processed_rows?.length) {
      return { segments: [], majoritySentiment: 'N/A' };
    }

    const rows  = analysisResults.processed_rows;
    const total = rows.length;

    const counts = { Positive: 0, Neutral: 0, Negative: 0 };
    rows.forEach((row) => {
      const label = row.sentiment_label;
      if (label && label in counts) counts[label] += 1;
    });

    let pctPositive = Math.round((counts.Positive / total) * 100);
    let pctNeutral  = Math.round((counts.Neutral  / total) * 100);
    let pctNegative = Math.round((counts.Negative / total) * 100);

    const sum = pctPositive + pctNeutral + pctNegative;
    if (sum !== 100 && sum > 0) {
      if      (pctPositive >= pctNeutral && pctPositive >= pctNegative) pctPositive += (100 - sum);
      else if (pctNeutral  >= pctPositive && pctNeutral >= pctNegative) pctNeutral  += (100 - sum);
      else                                                               pctNegative += (100 - sum);
    }

    const built = [
      { id: 'Positive', color: COLORS.Positive, pct: pctPositive, start: 0,           end: pctPositive },
      { id: 'Neutral',  color: COLORS.Neutral,  pct: pctNeutral,  start: pctPositive, end: pctPositive + pctNeutral },
      { id: 'Negative', color: COLORS.Negative, pct: pctNegative, start: pctPositive + pctNeutral, end: 100 },
    ];

    const majoritySentiment = built.reduce((max, seg) => seg.pct > max.pct ? seg : max, built[0]).id;
    return { segments: built, majoritySentiment };
  }, [analysisResults]);

  if (!analysisResults) {
    return (
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-[300px] flex flex-col items-center justify-center">
        <p className="text-sm text-slate-400">No data available</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-[300px] flex flex-col">

      <div className="mb-2 flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Sentiment Distribution</h3>
          <p className="text-xs text-slate-500 mt-0.5">Click a segment to filter the Review Explorer</p>
        </div>
        <span className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 bg-slate-100 text-slate-500 rounded-md border border-slate-200">
          <BookOpen className="w-3.5 h-3.5" />
          Lexicon
        </span>
      </div>

      <div className="flex-1 flex items-center justify-center gap-10">
        <div className="relative w-56 h-56">
          <svg viewBox="0 0 36 36" className="w-full h-full">
            {segments.map((seg) => {
              if (seg.pct === 0) return null;
              const isActive = selectedSentiment === seg.id;
              const isFaded  = selectedSentiment && !isActive;
              return (
                <path
                  key={seg.id}
                  d={describeArc(cx, cy, radius, seg.start, seg.end)}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth="4"
                  strokeLinecap="butt"
                  style={{ opacity: isFaded ? 0.3 : 1, cursor: 'pointer', transition: 'opacity 0.2s' }}
                  onClick={() => onSentimentClick(isActive ? null : seg.id)}
                />
              );
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-xs font-semibold text-slate-500">Overall</span>
            <span className="text-xl font-bold text-slate-900">{majoritySentiment}</span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {segments.map((seg) => (
            <button
              key={seg.id}
              onClick={() => onSentimentClick(selectedSentiment === seg.id ? null : seg.id)}
              className={`flex items-center gap-2.5 text-sm font-medium transition-colors ${
                selectedSentiment === seg.id ? 'text-slate-900' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
              {seg.id} ({seg.pct}%)
            </button>
          ))}
          {flaggedCount > 0 && hasOriginalLabels && (
            <button
              onClick={onMislabeledClick}
              className={`mt-1 pt-2 border-t border-slate-100 flex items-start gap-1.5 text-xs text-left max-w-[160px] transition-colors ${
                showMislabeled
                  ? 'text-amber-700 font-semibold'
                  : 'text-amber-600 hover:text-amber-700'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                {flaggedCount} row{flaggedCount !== 1 ? 's' : ''} potentially mislabeled — lexicon &amp; ML both disagree with original label
                {showMislabeled && <span className="block text-amber-500 font-normal">Click to clear</span>}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
