import React from 'react';
import { useDataset } from '../context/DatasetContext';

export function KeyInsights() {
  const { analysisResults } = useDataset();
  const insights = analysisResults?.insights;

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 min-h-[300px] flex flex-col">
      <h3 className="text-sm font-semibold text-slate-900 mb-4">Key Insights</h3>
      
      {!insights ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <p className="text-sm text-slate-500 max-w-[200px]">No insights available yet. Please run the analysis engine.</p>
        </div>
      ) : (
        <div className="flex-1 space-y-6 overflow-y-auto pr-2">
          
          {/* Insight 1: Conflict Detection */}
          <div className="relative pl-4">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-rose-500 rounded-full"></div>
            <h4 className="text-sm font-bold text-slate-900">Conflict Detection</h4>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              {insights.conflict_detection}
            </p>
          </div>

          {/* Insight 2: Confidence Warning */}
          <div className="relative pl-4">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500 rounded-full"></div>
            <h4 className="text-sm font-bold text-slate-900">Confidence Warning</h4>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              {insights.confidence_warning}
            </p>
          </div>

          {/* Insight 4: Actionable Recommendation */}
          <div className="relative pl-4">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 rounded-full"></div>
            <h4 className="text-sm font-bold text-slate-900">Actionable Recommendation</h4>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              {insights.actionable_recommendation}
            </p>
          </div>

        </div>
      )}
    </div>
  );
}
