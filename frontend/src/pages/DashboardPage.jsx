import { useState } from 'react';

import { KeyInsights } from '../components/KeyInsights';
import { SentimentChart } from '../components/SentimentChart';
import { EmotionHeatmap } from '../components/EmotionHeatmap';
import { AfinnHistogram } from '../components/AfinnHistogram';
import { BingWordFrequency } from '../components/BingWordFrequency';
import { ReviewExplorer } from '../components/ReviewExplorer';
import { ModelMetrics } from '../components/ModelMetrics';
import { ReportModal } from '../components/ReportModal';
import { Info, BarChart3, FileText } from 'lucide-react';
import { useDataset } from '../context/DatasetContext';

export default function InsightsDashboardPage() {
  const [selectedSentiment, setSelectedSentiment] = useState(null);
  const [showReport, setShowReport] = useState(false);
  const { analysisConfig, analysisResults } = useDataset();
  const selectedLexicon = analysisConfig?.lexicon?.toUpperCase() || 'NRC';

  return (
    <div className="flex flex-col min-h-full">
      {/* Scrollable content */}
      <div className="flex-1 p-8 space-y-6">

        <ModelMetrics />

        <div className="grid grid-cols-5 gap-6">
          <div className="col-span-2"><KeyInsights /></div>
          <div className="col-span-3">
            <SentimentChart
              selectedSentiment={selectedSentiment}
              onSentimentClick={setSelectedSentiment}
            />
          </div>
        </div>

        {/* Conditional chart by lexicon */}
        {selectedLexicon === 'NRC' ? (
          <EmotionHeatmap />
        ) : selectedLexicon === 'AFINN' ? (
          <AfinnHistogram />
        ) : selectedLexicon === 'BING' ? (
          <BingWordFrequency />
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 flex flex-col items-center justify-center min-h-[350px] text-center">
            <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mb-4">
              <BarChart3 className="w-6 h-6 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Polarity Distribution</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              A comprehensive polarity distribution breakdown is active for {selectedLexicon}.
            </p>
            <div className="mt-6 flex items-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-100 rounded-md text-indigo-700 text-xs font-medium">
              <Info className="w-3.5 h-3.5 shrink-0" />
              Emotion Heatmaps are only available for the NRC Lexicon.
            </div>
          </div>
        )}

        <ReviewExplorer selectedSentiment={selectedSentiment} />
      </div>

      {/* Generate Report bar — shown only after analysis runs */}
      {analysisResults && (
        <div className="sticky bottom-0 z-20 bg-white border-t border-slate-200 px-8 py-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] flex items-center justify-between shrink-0">
          <div>
            <p className="text-sm font-semibold text-slate-900">Analysis Complete</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Export a full report — raw data, preprocessing, results, and insights.
            </p>
          </div>
          <button
            onClick={() => setShowReport(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm hover:shadow-indigo-600/20"
          >
            <FileText className="w-4 h-4" />
            Generate Report
          </button>
        </div>
      )}

      {/* Report modal */}
      {showReport && <ReportModal onClose={() => setShowReport(false)} />}
    </div>
  );
}
