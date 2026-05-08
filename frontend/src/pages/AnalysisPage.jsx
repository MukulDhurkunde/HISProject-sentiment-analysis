import React, { useState } from 'react';
import { 
  Settings, 
  Database,
  Play,
  Info,
  CheckCircle2,
  Loader2,
  Cpu
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDataset } from '../context/DatasetContext';

const LEXICONS = [
  {
    id: 'bing',
    name: 'Bing Lexicon',
    type: 'Binary Scoring',
    description: 'Categorizes words in a binary fashion into positive and negative categories. Best for straightforward sentiment polarity.',
    tags: ['Positive', 'Negative']
  },
  {
    id: 'afinn',
    name: 'AFINN Lexicon',
    type: 'Numeric Scoring',
    description: 'Assigns words with a score that runs between -5 (highly negative) and +5 (highly positive). Ideal for measuring sentiment intensity.',
    tags: ['-5 to +5 Range']
  },
  {
    id: 'nrc',
    name: 'NRC Lexicon',
    type: 'Emotion-Based',
    description: 'Categorizes words into 8 basic emotions (anger, fear, anticipation, trust, surprise, sadness, joy, disgust) and two sentiments.',
    tags: ['8 Emotions', 'Complex Analysis']
  }
];

const ML_MODELS = [
  {
    id: 'naive_bayes',
    name: 'Naive Bayes',
    type: 'Probabilistic Classification',
    description: 'Uses Bayesian statistics for efficient text categorization. Baseline model for large-scale analysis.'
  },
  {
    id: 'svm',
    name: 'Support Vector Machine (SVM)',
    type: 'Optimal Boundary Separation',
    description: 'Finds the optimal hyperplane to separate classes. Ideal for high-accuracy requirements.'
  },
  {
    id: 'random_forest',
    name: 'Random Forest',
    type: 'Ensemble Learning',
    description: 'Builds a multitude of decision trees and merges results. Robust against overfitting.'
  }
];

export default function AnalysisEnginePage() {
  const navigate = useNavigate();
  const { parsedData, analysisConfig, setAnalysisConfig } = useDataset();
  const { lexicon: selectedLexicon, mlModel: selectedMlModel = 'naive_bayes', sensitivity, themeCount } = analysisConfig || { lexicon: 'afinn', mlModel: 'naive_bayes', sensitivity: 50, themeCount: 8 };

  const setSelectedLexicon = (val) => setAnalysisConfig(prev => ({ ...prev, lexicon: val }));
  const setSelectedMlModel = (val) => setAnalysisConfig(prev => ({ ...prev, mlModel: val }));
  const setSensitivity = (val) => setAnalysisConfig(prev => ({ ...prev, sensitivity: val }));
  const setThemeCount = (val) => setAnalysisConfig(prev => ({ ...prev, themeCount: val }));

  const [isProcessing, setIsProcessing] = useState(false);

  const rowCount = parsedData?.rows?.length || 0;

  const handleRunAnalysis = () => {
    setIsProcessing(true);
    // Simulate R-API call delay
    setTimeout(() => {
      setIsProcessing(false);
      navigate('/dashboard');
    }, 3000);
  };

  return (
    <div className="flex flex-col h-full relative w-full bg-slate-50/50 font-sans text-slate-800">
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-4xl mx-auto space-y-6 pb-6">
          
          {/* 1. Lexicon Selection */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-200 bg-slate-50/50">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg font-semibold text-slate-900">Choose Sentiment Lexicon</h3>
                  <Info className="w-4 h-4 text-slate-400" />
                </div>
                <p className="text-sm text-slate-500">Select the underlying dictionary applied to your pre-processed text data.</p>
              </div>
              
              <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                {LEXICONS.map((lexicon) => (
                  <div 
                    key={lexicon.id}
                    onClick={() => setSelectedLexicon(lexicon.id)}
                    className={`relative p-5 rounded-xl border-2 transition-all cursor-pointer flex flex-col h-full ${
                      selectedLexicon === lexicon.id 
                        ? 'border-indigo-600 bg-indigo-50/30' 
                        : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50'
                    }`}
                  >
                    {/* Active Checkmark */}
                    <div className={`absolute top-4 right-4 w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                      selectedLexicon === lexicon.id ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300'
                    }`}>
                      {selectedLexicon === lexicon.id && <CheckCircle2 className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
                    </div>

                    <h4 className="text-base font-semibold text-slate-900 mb-1 pr-6">{lexicon.name}</h4>
                    <span className="text-xs font-medium text-indigo-600 bg-indigo-50 self-start px-2 py-0.5 rounded-md mb-3 border border-indigo-100">
                      {lexicon.type}
                    </span>
                    
                    <p className="text-sm text-slate-600 leading-relaxed mb-4 flex-1">
                      {lexicon.description}
                    </p>

                    <div className="flex flex-wrap gap-1.5 mt-auto">
                      {lexicon.tags.map(tag => (
                        <span key={tag} className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 bg-slate-100 px-2 py-1 rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Machine Learning Model Selection */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-200 bg-slate-50/50">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg font-semibold text-slate-900">Choose Machine Learning Model</h3>
                  <Cpu className="w-4 h-4 text-slate-400" />
                </div>
                <p className="text-sm text-slate-500">Select an advanced predictive model for dynamic text classification.</p>
              </div>
              
              <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                {ML_MODELS.map((model) => (
                  <div 
                    key={model.id}
                    onClick={() => setSelectedMlModel(model.id)}
                    className={`relative p-5 rounded-xl border-2 transition-all cursor-pointer flex flex-col h-full ${
                      selectedMlModel === model.id 
                        ? 'border-indigo-600 bg-indigo-50/30' 
                        : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50'
                    }`}
                  >
                    {/* Active Checkmark */}
                    <div className={`absolute top-4 right-4 w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                      selectedMlModel === model.id ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300'
                    }`}>
                      {selectedMlModel === model.id && <CheckCircle2 className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
                    </div>

                    <h4 className="text-base font-semibold text-slate-900 mb-1 pr-6">{model.name}</h4>
                    <span className="text-xs font-medium text-indigo-600 bg-indigo-50 self-start px-2 py-0.5 rounded-md mb-3 border border-indigo-100">
                      {model.type}
                    </span>
                    
                    <p className="text-sm text-slate-600 leading-relaxed flex-1">
                      {model.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Analysis Sensitivity & Granularity */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-200 bg-slate-50/50">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg font-semibold text-slate-900">Granularity Settings</h3>
                  <Settings className="w-4 h-4 text-slate-400" />
                </div>
                <p className="text-sm text-slate-500">Fine-tune how strictly the engine identifies and categorizes emotional signals.</p>
              </div>
              
              <div className="p-6 flex flex-col md:flex-row gap-8 lg:gap-12">
                
                {/* Slider */}
                <div className="flex-1">
                  <div className="flex justify-between items-end mb-4">
                    <label className="block text-sm font-semibold text-slate-900">
                      Analysis Sensitivity Threshold
                    </label>
                    <span className="text-lg font-bold text-indigo-600">{sensitivity}%</span>
                  </div>
                  
                  <div className="relative pt-2 pb-6">
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      value={sensitivity}
                      onChange={(e) => setSensitivity(Number(e.target.value))}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                    <div className="flex justify-between text-xs font-medium text-slate-400 mt-2 absolute w-full bottom-0">
                      <span>Strict (Conservative)</span>
                      <span>Balanced</span>
                      <span>Broad (Aggressive)</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                    Higher sensitivity will classify more nuanced words as polarized, reducing the number of 'Neutral' classifications.
                  </p>
                </div>

                {/* Number Input */}
                <div className="w-full md:w-64 shrink-0">
                  <label className="block text-sm font-semibold text-slate-900 mb-2">
                    Emotional Themes count
                  </label>
                  <p className="text-xs text-slate-500 mb-3 leading-relaxed">
                    Specify the maximum number of distinct emotional clusters to extract. (Primarily affects NRC lexicon).
                  </p>
                  <div className="relative">
                    <input 
                      type="number" 
                      min="2" 
                      max="8"
                      value={themeCount}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setThemeCount(val > 8 ? 8 : val);
                      }}
                      disabled={selectedLexicon !== 'nrc'}
                      className={`block w-full px-4 py-2.5 border rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-colors ${
                        selectedLexicon !== 'nrc' ? 'bg-slate-100 border-slate-200 cursor-not-allowed text-slate-400' : 'bg-white border-slate-300'
                      }`}
                    />
                  </div>
                  {selectedLexicon !== 'nrc' && (
                     <span className="text-[11px] font-medium text-amber-600 mt-2 block">
                       * Only applicable when using the NRC Lexicon.
                     </span>
                  )}
                </div>

              </div>
            </div>

          </div>
        </div>

      {/* 3. Execution Control Bar */}
      <div className="w-full bg-white border-t border-slate-200 p-4 px-8 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
           <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center border border-indigo-100">
              <Database className="w-5 h-5 text-indigo-600" />
           </div>
           <div>
              <p className="text-sm font-bold text-slate-900">{rowCount.toLocaleString()}</p>
              <p className="text-xs font-medium text-slate-500">Ready for analysis</p>
           </div>
        </div>

        <button 
          onClick={handleRunAnalysis}
          disabled={isProcessing || rowCount === 0}
          className={`py-3 px-8 rounded-lg text-sm font-semibold shadow-sm transition-all flex items-center gap-2 ${
            isProcessing || rowCount === 0
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200' 
              : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-indigo-600/20 hover:-translate-y-0.5'
          }`}
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Executing R Script...
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              Run Sentiment Analysis
            </>
          )}
        </button>
      </div>
    </div>
  );
}
