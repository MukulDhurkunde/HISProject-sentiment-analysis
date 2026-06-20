import { useState, useMemo, useEffect } from 'react';
import { Filter, Search } from 'lucide-react';
import { useDataset } from '../context/DatasetContext';

const ROWS_PER_PAGE = 10;

export function ReviewExplorer({ selectedSentiment }) {
  const { analysisResults, selectedTextColumn } = useDataset();
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(0);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(0);
  }, [searchQuery, selectedSentiment]);

  // Create fast lookup sets for positive and negative words
  const posSet = useMemo(() => new Set(analysisResults?.insights?.lexicon_words?.positive || []), [analysisResults]);
  const negSet = useMemo(() => new Set(analysisResults?.insights?.lexicon_words?.negative || []), [analysisResults]);

  // Helper to highlight text dynamically based on exact word matches
  const highlightText = (text, polarity) => {
    if (!text || polarity === 'Neutral') return text;
    // Split by non-word characters (excluding apostrophes) to preserve punctuation and spacing
    const tokens = text.split(/([^\w']+)/);
    
    return tokens.map((token, idx) => {
      const lower = token.toLowerCase();
      if (polarity === 'Positive' && posSet.has(lower)) {
        return <span key={idx} className="bg-emerald-100 text-emerald-800 px-1 rounded font-medium">{token}</span>;
      }
      if (polarity === 'Negative' && negSet.has(lower)) {
        return <span key={idx} className="bg-rose-100 text-rose-800 px-1 rounded font-medium">{token}</span>;
      }
      return token;
    });
  };

  const rows = useMemo(() => {
    if (!analysisResults?.processed_rows) return [];

    return analysisResults.processed_rows.map((row, index) => ({
      id: `ROW-${String(index + 1).padStart(3, '0')}`,
      polarity: row.sentiment_label,
      emotion: row.emotional_themes
        ? row.emotional_themes.split(',')[0].trim()
        : 'None',
      text: selectedTextColumn ? String(row[selectedTextColumn] ?? '') : '',
    }));
  }, [analysisResults, selectedTextColumn]);

  const filteredRows = useMemo(() => {
    let result = rows;

    if (selectedSentiment) {
      result = result.filter((r) => r.polarity === selectedSentiment);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      result = result.filter((r) =>
        r.text.toLowerCase().includes(query)
      );
    }

    return result;
  }, [rows, selectedSentiment, searchQuery]);

  const totalFiltered = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / ROWS_PER_PAGE));
  
  // Ensure current page is valid after filtering
  const safePage = Math.min(currentPage, totalPages - 1);
  const startIdx = safePage * ROWS_PER_PAGE;
  const endIdx = Math.min(startIdx + ROWS_PER_PAGE, totalFiltered);
  const displayRows = filteredRows.slice(startIdx, endIdx);

  if (!analysisResults) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-12 text-center">
          <p className="text-sm text-slate-500">
            No analysis data available. Upload and analyse a dataset to explore reviews.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-200 bg-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <svg className="w-4 h-4 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Review Explorer
          </h3>
          <p className="text-xs text-slate-500 mt-1">Explore raw texts with sentiment keyword highlighting</p>
        </div>

        <div className="flex items-center gap-3">
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

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
            <tr>
              <th className="px-6 py-4">Row ID</th>
              <th className="px-6 py-4">Polarity</th>
              <th className="px-6 py-4">Primary Emotion</th>
              <th className="px-6 py-4">Source Text</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {displayRows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-sm text-slate-500">
                  No matching reviews found.
                </td>
              </tr>
            ) : (
              displayRows.map((review) => (
                <tr key={review.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-600">{review.id}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border ${
                      review.polarity === 'Positive' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      review.polarity === 'Negative' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                      'bg-slate-100 text-slate-700 border-slate-200'
                    }`}>
                      {review.polarity}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-600">{review.emotion}</td>
                  <td className="px-6 py-4 text-slate-800">
                    <div className="leading-relaxed">{highlightText(review.text, review.polarity)}</div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="px-6 py-3 border-t border-slate-200 flex items-center justify-between bg-slate-50/50 text-sm text-slate-600">
        <div className="flex items-center gap-2">
          <span className="font-medium">
            Showing {displayRows.length > 0 ? startIdx + 1 : 0}–{endIdx} of {totalFiltered.toLocaleString()} records
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">
            Page {safePage + 1} of {totalPages}
          </span>
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
