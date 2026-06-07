import React from 'react';
import { useDataset } from '../context/DatasetContext';
import { Target, Activity, PieChart, Crosshair } from 'lucide-react';

export function ModelMetrics() {
  const cards = [
    { label: 'Accuracy', value: 'N/A', icon: Target, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'F1-Score', value: 'N/A', icon: Activity, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Precision', value: 'N/A', icon: Crosshair, color: 'text-violet-600', bg: 'bg-violet-50' },
    { label: 'Recall', value: 'N/A', icon: PieChart, color: 'text-amber-600', bg: 'bg-amber-50' },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-base font-semibold text-slate-900">Model Performance Metrics</h3>
        <span className="text-xs font-medium px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md border border-slate-200">
          ML Training Deferred
        </span>
      </div>
      <p className="text-xs text-slate-400 mb-4">
        Machine learning model training is not yet active. Metrics will appear here once ML models are enabled.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 opacity-50">
        {cards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div key={idx} className="flex items-center gap-4 p-4 rounded-lg border border-slate-100 bg-slate-50">
              <div className={`p-3 rounded-lg ${card.bg} ${card.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-medium text-slate-500">{card.label}</div>
                <div className="text-xl font-bold text-slate-900">{card.value}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
