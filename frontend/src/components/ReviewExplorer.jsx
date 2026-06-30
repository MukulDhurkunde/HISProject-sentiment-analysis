import { useState, useMemo, useEffect } from 'react';
import { Search, Cpu, AlertTriangle, X } from 'lucide-react';
import { useDataset } from '../context/DatasetContext';

const ROWS_PER_PAGE = 10;

const POLARITY_STYLES = {
  Positive: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Negative: 'bg-rose-50 text-rose-700 border-rose-200',
  Neutral:  'bg-slate-100 text-slate-600 border-slate-200',
};

export function ReviewExplorer({ selectedSentiment, showMislabeled, onClearMislabeled }) {
  const { analysisResults, selectedTextColumn, analysisConfig } = useDataset();
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(0);

  const isNrc = analysisConfig?.lexicon === 'nrc';

  useEffect(() => { setCurrentPage(0); }, [searchQuery, selectedSentiment, showMislabeled]);

  const hasOriginalLabels = useMemo(() =>
    analysisResults?.processed_rows?.some(r => r.original_sentiment_label),
    [analysisResults]
  );

  const hasMlLabels = useMemo(() =>
    analysisResults?.processed_rows?.some(r => r.ml_sentiment_label),
    [analysisResults]
  );

  const posSet = useMemo(() => new Set(analysisResults?.insights?.lexicon_words?.positive || []), [analysisResults]);
  const negSet = useMemo(() => new Set(analysisResults?.insights?.lexicon_words?.negative || []), [analysisResults]);

  // Highlight words based on lexicon classification — shows why lexicon reached its verdict
  const highlightText = (text, lexiconPolarity) => {
    if (!text || lexiconPolarity === 'Neutral') return text;
    const tokens = text.split(/([^\w']+)/);
    return tokens.map((token, idx) => {
      const lower = token.toLowerCase();
      if (lexiconPolarity === 'Positive' && posSet.has(lower))
        return <span key={idx} className="bg-green-100 text-green-800 px-1 rounded font-medium">{token}</span>;
      if (lexiconPolarity === 'Negative' && negSet.has(lower))
        return <span key={idx} className="bg-red-100 text-red-800 px-1 rounded font-medium">{token}</span>;
      return token;
    });
  };

  const rows = useMemo(() => {
    if (!analysisResults?.processed_rows) return [];
    return analysisResults.processed_rows.map((row, index) => {
      const raw = selectedTextColumn ? row[selectedTextColumn] : null;
      const rawStr = raw == null ? '' : String(raw).trim();
      const isMissing = rawStr === '' || rawStr === '[No Review]';
      return {
        id:               `ROW-${String(index + 1).padStart(3, '0')}`,
        originalPolarity: row.original_sentiment_label || null,
        lexiconPolarity:  row.sentiment_label,
        mlPolarity:       row.ml_sentiment_label || null,
        emotion:          row.emotional_themes ? row.emotional_themes.split(',')[0].trim() : 'None',
        text:             isMissing ? '' : rawStr,
        isMissing,
      };
    });
  }, [analysisResults, selectedTextColumn]);

  const filteredRows = useMemo(() => {
    let result = rows.filter(r => !r.isMissing);
    if (showMislabeled) {
      result = result.filter(r =>
        r.originalPolarity &&
        r.mlPolarity &&
        r.mlPolarity !== r.originalPolarity &&
        r.lexiconPolarity !== r.originalPolarity
      );
    } else if (selectedSentiment) {
      result = result.filter(r =>
        r.lexiconPolarity === selectedSentiment
      );
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(r => r.text.toLowerCase().includes(q));
    }
    return result;
  }, [rows, selectedSentiment, showMislabeled, searchQuery]);

  const totalFiltered = filteredRows.length;
  const totalPages    = Math.max(1, Math.ceil(totalFiltered / ROWS_PER_PAGE));
  const safePage      = Math.min(currentPage, totalPages - 1);
  const startIdx      = safePage * ROWS_PER_PAGE;
  const endIdx        = Math.min(startIdx + ROWS_PER_PAGE, totalFiltered);
  const displayRows   = filteredRows.slice(startIdx, endIdx);

  // Row ID + Label (optional) + Lexicon Says + ML Says (optional) + Emotion (NRC only) + Source Text
  const colCount = 3 + (hasOriginalLabels ? 1 : 0) + (hasMlLabels ? 1 : 0) + (isNrc ? 1 : 0);

  if (!analysisResults) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-12 text-center">
          <p className="text-sm text-slate-500">No analysis data available. Upload and analyse a dataset to explore reviews.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">

      {/* Header */}
      <div className="p-6 border-b border-slate-200 bg-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <svg className="w-4 h-4 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Review Explorer
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Word highlights show which words drove the lexicon classification · Click chart segments to filter
            </p>
          </div>

          <div className="flex items-center gap-3">
            {hasMlLabels && (
              <span className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 bg-indigo-50 text-indigo-700 rounded-md border border-indigo-200 shrink-0">
                <Cpu className="w-3.5 h-3.5" />
                ML Active
              </span>
            )}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search reviews..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-full md:w-64"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Mislabeled filter banner */}
      {showMislabeled && (
        <div className="px-6 py-2.5 bg-amber-50 border-b border-amber-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-amber-700 font-medium">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            Showing rows where lexicon &amp; ML both disagree with the original label
          </div>
          <button onClick={onClearMislabeled} className="text-amber-500 hover:text-amber-700 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
            <tr>
              <th className="px-6 py-4 w-24">Row ID</th>
              {hasOriginalLabels && <th className="px-6 py-4">Label</th>}
              <th className="px-6 py-4">Lexicon Says</th>
              {hasMlLabels && <th className="px-6 py-4">ML Says</th>}
              {isNrc && <th className="px-6 py-4">Emotion</th>}
              <th className="px-6 py-4">Source Text</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {displayRows.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="px-6 py-8 text-center text-sm text-slate-500">
                  No matching reviews found.
                </td>
              </tr>
            ) : (
              displayRows.map((review) => (
                <tr key={review.id} className="transition-colors hover:bg-slate-50/50">
                  <td className="px-6 py-4 font-medium text-slate-500 text-xs">{review.id}</td>

                  {/* Original label */}
                  {hasOriginalLabels && (
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border ${POLARITY_STYLES[review.originalPolarity] || POLARITY_STYLES.Neutral}`}>
                        {review.originalPolarity}
                      </span>
                    </td>
                  )}

                  {/* Lexicon Says — always shown, drives word highlights */}
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border ${POLARITY_STYLES[review.lexiconPolarity] || POLARITY_STYLES.Neutral}`}>
                      {review.lexiconPolarity}
                    </span>
                  </td>

                  {/* ML Says */}
                  {hasMlLabels && (
                    <td className="px-6 py-4">
                      {review.mlPolarity ? (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold border ${POLARITY_STYLES[review.mlPolarity] || POLARITY_STYLES.Neutral}`}>
                          <Cpu className="w-3 h-3 opacity-70" />
                          {review.mlPolarity}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                  )}

                  {/* Emotion — NRC only */}
                  {isNrc && (
                    <td className="px-6 py-4 text-slate-600 text-xs">{review.emotion}</td>
                  )}

                  {/* Source text — word highlights driven by Lexicon Says */}
                  <td className="px-6 py-4 text-slate-800">
                    <div className="leading-relaxed text-sm">
                      {highlightText(review.text, review.lexiconPolarity)}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="px-6 py-3 border-t border-slate-200 flex items-center justify-between bg-slate-50/50">
        <span className="font-medium text-xs text-slate-600">
          Showing {displayRows.length > 0 ? startIdx + 1 : 0}–{endIdx} of {totalFiltered.toLocaleString()} records
        </span>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">Page {safePage + 1} of {totalPages}</span>
          <button
            disabled={safePage === 0}
            onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
            className="p-2 hover:bg-white rounded-lg border border-slate-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            disabled={safePage >= totalPages - 1}
            onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
            className="p-2 hover:bg-white rounded-lg border border-slate-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
