import { useState } from 'react';

import { KeyInsights } from '../components/KeyInsights';
import { SentimentChart } from '../components/SentimentChart';
import { EmotionHeatmap } from '../components/EmotionHeatmap';
import { AfinnHistogram } from '../components/AfinnHistogram';
import { BingWordFrequency } from '../components/BingWordFrequency';
import { ReviewExplorer } from '../components/ReviewExplorer';
import { Info, BarChart3 } from 'lucide-react';
import { useDataset } from '../context/DatasetContext';

export default function InsightsDashboardPage({ data }) {
  const [selectedSentiment, setSelectedSentiment] = useState(null);
  const { analysisConfig } = useDataset();
  const selectedLexicon = analysisConfig?.lexicon?.toUpperCase() || 'NRC';

  return (
    <div className="p-8 space-y-6">


      <div className="grid grid-cols-5 gap-6">
        <div className="col-span-2"><KeyInsights /></div>
        <div className="col-span-3">
          <SentimentChart
            selectedSentiment={selectedSentiment}
            onSentimentClick={setSelectedSentiment}
          />
        </div>
      </div>

      {/* Conditional Chart Rendering based on Lexicon */}
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
  );
}