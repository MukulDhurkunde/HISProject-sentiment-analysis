// Helper: convert a percentage range into an SVG arc path string
function describeArc(cx, cy, r, startPercent, endPercent) {
  const startAngle = (startPercent / 100) * 360 - 90;
  const endAngle = (endPercent / 100) * 360 - 90;
  const startRad = (startAngle * Math.PI) / 180;
  const endRad = (endAngle * Math.PI) / 180;

  const x1 = cx + r * Math.cos(startRad);
  const y1 = cy + r * Math.sin(startRad);
  const x2 = cx + r * Math.cos(endRad);
  const y2 = cy + r * Math.sin(endRad);

  const largeArc = endPercent - startPercent > 50 ? 1 : 0;

  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
}

const SEGMENTS = [
  { id: 'Positive', color: '#22c55e', start: 0, end: 65 },
  { id: 'Neutral',  color: '#94a3b8', start: 65, end: 80 },
  { id: 'Negative', color: '#ef4444', start: 80, end: 100 },
];

export function SentimentChart({ selectedSentiment, onSentimentClick }) {
  const cx = 18, cy = 18, r = 14;

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-[300px] flex flex-col">
      <div className="mb-2">
        <h3 className="text-sm font-semibold text-slate-900">Sentiment Distribution</h3>
        <p className="text-xs text-slate-500 mt-0.5">Click a segment to filter the Review Explorer</p>
      </div>
      
      <div className="flex-1 flex items-center justify-center gap-10">
        {/* SVG Donut Chart */}
        <div className="relative w-56 h-56">
          <svg viewBox="0 0 36 36" className="w-full h-full">
            {SEGMENTS.map((seg) => {
              const isActive = selectedSentiment === seg.id;
              const isFaded = selectedSentiment && !isActive;

              return (
                <path
                  key={seg.id}
                  d={describeArc(cx, cy, r, seg.start, seg.end)}
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
          
          {/* Center Text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-xs font-semibold text-slate-500">Overall</span>
            <span className="text-2xl font-bold text-slate-900">65%</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-col gap-3">
          {SEGMENTS.map((seg) => (
            <button
              key={seg.id}
              onClick={() => onSentimentClick(selectedSentiment === seg.id ? null : seg.id)}
              className={`flex items-center gap-2.5 text-sm font-medium transition-colors ${
                selectedSentiment === seg.id ? 'text-slate-900' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: seg.color }}></span>
              {seg.id}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
