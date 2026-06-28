import React from 'react';
import { useDataset } from '../context/DatasetContext';
import { Target, Activity, PieChart, Crosshair, CheckCircle2, AlertTriangle } from 'lucide-react';

export function ModelMetrics() {
  const { analysisResults } = useDataset();
  const ml = analysisResults?.ml_metrics || null;
  const mlError = analysisResults?.ml_error || null;

  const hasMetrics = ml && ml.accuracy != null;

  const cards = [
    {
      label: 'Accuracy',
      value: hasMetrics ? `${ml.accuracy}%` : 'N/A',
      icon: Target,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50'
    },
    {
      label: 'F1-Score',
      value: hasMetrics ? `${ml.f1_score}%` : 'N/A',
      icon: Activity,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50'
    },
    {
      label: 'Precision',
      value: hasMetrics ? `${ml.precision}%` : 'N/A',
      icon: Crosshair,
      color: 'text-violet-600',
      bg: 'bg-violet-50'
    },
    {
      label: 'Recall',
      value: hasMetrics ? `${ml.recall}%` : 'N/A',
      icon: PieChart,
      color: 'text-amber-600',
      bg: 'bg-amber-50'
    },
  ];

  const MODEL_LABELS = {
    svm:                 'Support Vector Machine',
    penalized_logistic:  'Penalized Logistic Regression',
    random_forest:       'Random Forest',
  };
  const modelDisplayName = ml?.model_name ? (MODEL_LABELS[ml.model_name] || ml.model_name) : null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-base font-semibold text-slate-900">Model Performance Metrics</h3>
        {hasMetrics ? (
          <span className="text-xs font-medium px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-md border border-emerald-200 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {modelDisplayName} — Training Complete
          </span>
        ) : mlError ? (
          <span className="text-xs font-medium px-2.5 py-1 bg-rose-50 text-rose-700 rounded-md border border-rose-200 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            Training Failed
          </span>
        ) : (
          <span className="text-xs font-medium px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md border border-slate-200">
            ML Training Deferred
          </span>
        )}
      </div>
      <p className="text-xs text-slate-400 mb-4">
        {hasMetrics
          ? `Trained on ${ml.train_size} samples · Evaluated on ${ml.test_size} held-out samples (80/20 stratified split) · Model predictions shown alongside your labels in the Review Explorer.`
          : mlError
          ? `ML training error: ${mlError}`
          : 'Machine learning model training is not yet active. Metrics will appear here once ML models are enabled.'}
      </p>
      <div className={`grid grid-cols-1 md:grid-cols-4 gap-4 ${hasMetrics ? '' : 'opacity-50'}`}>
        {cards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div key={idx} className={`flex items-center gap-4 p-4 rounded-lg border ${
              hasMetrics
                ? 'border-slate-200 bg-white'
                : 'border-slate-100 bg-slate-50'
            }`}>
              <div className={`p-3 rounded-lg ${card.bg} ${card.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-medium text-slate-500">{card.label}</div>
                <div className={`text-xl font-bold ${hasMetrics ? 'text-slate-900' : 'text-slate-400'}`}>
                  {card.value}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
