import React from 'react';
import { useDataset } from '../context/DatasetContext';
import { Target, Activity, PieChart, Crosshair } from 'lucide-react';

export function ModelMetrics() {
  const { analysisConfig } = useDataset();
  const mlModel = analysisConfig?.mlModel || 'naive_bayes';

  // Mock metrics based on model
  const metricsData = {
    naive_bayes: {
      name: 'Naive Bayes',
      accuracy: '82.4%',
      f1: '81.2%',
      precision: '83.1%',
      recall: '80.5%'
    },
    svm: {
      name: 'Support Vector Machine',
      accuracy: '87.1%',
      f1: '86.5%',
      precision: '88.2%',
      recall: '85.9%'
    },
    random_forest: {
      name: 'Random Forest',
      accuracy: '89.5%',
      f1: '88.8%',
      precision: '89.4%',
      recall: '88.2%'
    }
  };

  const data = metricsData[mlModel] || metricsData.naive_bayes;

  const cards = [
    { label: 'Accuracy', value: data.accuracy, icon: Target, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'F1-Score', value: data.f1, icon: Activity, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Precision', value: data.precision, icon: Crosshair, color: 'text-violet-600', bg: 'bg-violet-50' },
    { label: 'Recall', value: data.recall, icon: PieChart, color: 'text-amber-600', bg: 'bg-amber-50' },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-slate-900">Model Performance Metrics</h3>
        <span className="text-xs font-medium px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md border border-slate-200">
          Active Model: {data.name}
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {cards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div key={idx} className="flex items-center gap-4 p-4 rounded-lg border border-slate-100 bg-slate-50 hover:border-indigo-100 transition-colors">
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
