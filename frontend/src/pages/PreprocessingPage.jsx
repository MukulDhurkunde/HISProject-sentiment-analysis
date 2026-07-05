import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDataset } from '../context/DatasetContext';
import { authFetch } from '../utils/api';
import { 
  BarChart3, 
  Settings, 
  Database,
  FileText,
  Trash2,
  Scissors,
  RotateCcw,
  Activity,
  CheckCircle2,
  Filter,
  ArrowRight,
  AlertCircle,
  Loader2
} from 'lucide-react';

export default function PreprocessingPage() {
  const navigate = useNavigate();
  const { parsedData, originalData, selectedTextColumn, labelColumn, setParsedData, setAppliedPreprocessConfig, appliedPreprocessConfig } = useDataset();
  const [missingHandling, setMissingHandling] = useState(appliedPreprocessConfig?.missingHandling || 'skip');

  // Whether a text column was selected from the Ingestion Hub
  const hasTextColumn = !!selectedTextColumn;
  const targetColumns = [selectedTextColumn, labelColumn].filter(Boolean);

  // Normalization Toggles
  const [config, setConfig] = useState(appliedPreprocessConfig?.config || {
    lowercase: false,
    removeUrlsHtml: false,
    stopwords: false,
    punctuation: false,
    specialChars: false,
    numbers: false
  });

  const toggleConfig = (key) => {
    setConfig(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const [apiData, setApiData] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState(null);

  // Sync with backend on config changes
  useEffect(() => {
    const dataToProcess = originalData || parsedData;
    if (!dataToProcess || !hasTextColumn) {
      setApiData(null);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsSyncing(true);
      setError(null);
      try {
        // Only send first 20 rows for live preview (performance optimization)
        const previewRows = dataToProcess.rows.slice(0, 20);
        const response = await authFetch('http://localhost:8000/api/preprocess', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            df_rows: previewRows,
            columns: targetColumns,
            missing_strategy: missingHandling || "skip",
            config: config
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API error (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        setApiData(data);
      } catch (err) {
        console.error("Failed to sync with backend:", err);
        setError(err.message || "Failed to connect to backend");
      } finally {
        setIsSyncing(false);
      }
    }, 500); // Debounce to prevent spamming backend

    return () => clearTimeout(timeoutId);
  }, [originalData, parsedData, selectedTextColumn, missingHandling, config, hasTextColumn]);

  const dataToProcess = originalData || parsedData;
  const totalRows = dataToProcess?.rows?.length || 0;
  const stats = {
    cleanedRecords: totalRows.toLocaleString(),
    vocabSize: apiData?.stats?.vocab_size ?? 0,
    noiseReduction: apiData?.stats?.noise_reduction ?? 0
  };

  const transformedByColumn = apiData?.preview || {};

  const resetConfig = () => {
    setConfig({
      lowercase: false,
      removeUrlsHtml: false,
      stopwords: false,
      punctuation: false,
      specialChars: false,
      numbers: false
    });
    setMissingHandling('skip');
  };

  const handleApplyTransformations = async () => {
    const dataToProcess = originalData || parsedData;
    if (!dataToProcess || !hasTextColumn) return;

    setIsApplying(true);
    setError(null);

    try {
      // Send ALL rows for full processing
      const response = await authFetch('http://localhost:8000/api/preprocess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          df_rows: dataToProcess.rows,
          columns: targetColumns,
          missing_strategy: missingHandling || "skip",
          config: config
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();

      setParsedData({
        ...dataToProcess,
        rows: data.processed_df
      });

      setAppliedPreprocessConfig({
        config,
        missingHandling,
        originalCount: dataToProcess.rows.length,
        processedCount: data.processed_df?.length ?? 0,
        vocabSize: data.stats?.vocab_size ?? 0,
        noiseReduction: data.stats?.noise_reduction ?? 0,
      });
      navigate('/analysis');
    } catch (err) {
      console.error("Failed to apply transformations:", err);
      setError(err.message || "Failed to process full dataset");
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="h-full flex flex-col lg:flex-row p-6 gap-6">
          
          {/* Column 1: Configuration Sidebar */}
          <div className="w-full lg:w-[320px] shrink-0 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
            <div className="p-5 border-b border-slate-200 bg-slate-50/50">
              <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <Settings className="w-5 h-5 text-indigo-600" />
                The Cleaning Toolkit
              </h3>
            </div>
            
            <div className="flex-1 overflow-y-auto p-5 space-y-8">
              {/* Missing Value Handling */}
              <div>
                <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <Trash2 className="w-4 h-4 text-slate-400" />
                  Handle Missing Text
                </h4>
                <div className="relative">
                  <select 
                    value={missingHandling}
                    onChange={(e) => setMissingHandling(e.target.value)}
                    className="w-full bg-white border border-slate-300 text-slate-700 rounded-lg py-2.5 px-3 text-sm focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none cursor-pointer appearance-none shadow-sm transition-colors hover:border-slate-400"
                  >
                    <option value="" disabled>Select strategy...</option>
                    <option value="deletion">Row Deletion</option>
                    <option value="skip">Skip in Analysis</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Text Normalization */}
              <div>
                <h4 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Scissors className="w-4 h-4 text-slate-400" />
                  Text Normalization
                </h4>
                <div className="space-y-3">
                  {[
                    { id: 'lowercase', label: 'Convert to Lowercase' },
                    { id: 'removeUrlsHtml', label: 'Remove URLs / HTML' },
                    { id: 'stopwords', label: 'Remove Stopwords' },
                    { id: 'punctuation', label: 'Remove Punctuation' },
                    { id: 'specialChars', label: 'Remove Special Characters' },
                    { id: 'numbers', label: 'Remove Numbers' }
                  ].map((item) => (
                    <label key={item.id} className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative flex items-center justify-center w-5 h-5 border-2 border-slate-300 rounded bg-white transition-colors overflow-hidden">
                        <input 
                          type="checkbox"
                          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                          checked={config[item.id]}
                          onChange={() => toggleConfig(item.id)}
                        />
                        {config[item.id] ? (
                          <div className="absolute inset-0 bg-indigo-600 flex items-center justify-center">
                            <CheckCircle2 className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                          </div>
                        ) : null}
                      </div>
                      <span className={`text-sm font-medium transition-colors ${config[item.id] ? 'text-indigo-600' : 'text-slate-600 group-hover:text-slate-900'}`}>
                        {item.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Column 2: Main Transformation Workspace */}
          <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col min-w-0">
            <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Live Comparison</h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  {hasTextColumn
                    ? `Transforming column: ${selectedTextColumn}`
                    : 'Real-time preview of text transformations'}
                </p>
              </div>
              {hasTextColumn && (
                <div className="text-xs font-medium px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-md border border-indigo-100 flex items-center gap-1.5">
                  {isSyncing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Activity className="w-3.5 h-3.5" />
                  )}
                  {isSyncing ? 'Syncing with R...' : 'Live Sync'}
                </div>
              )}
            </div>
            
            <div className="flex-1 overflow-auto p-0 relative">
              {!hasTextColumn ? (
                <div className="flex-1 flex flex-col items-center justify-center py-20 text-center px-6">
                  <div className="p-4 bg-amber-50 rounded-full mb-4">
                    <AlertCircle className="w-8 h-8 text-amber-500" />
                  </div>
                  <h4 className="text-base font-semibold text-slate-700 mb-1">No text column selected</h4>
                  <p className="text-sm text-slate-500 max-w-sm">
                    Please go back to the <span className="font-medium text-indigo-600">Data Ingestion Hub</span> and select a text column before preprocessing.
                  </p>
                </div>
              ) : error ? (
                <div className="flex-1 flex flex-col items-center justify-center py-20 text-center px-6">
                  <div className="p-4 bg-rose-50 rounded-full mb-4">
                    <AlertCircle className="w-8 h-8 text-rose-500" />
                  </div>
                  <h4 className="text-base font-semibold text-rose-700 mb-1">Preprocessing Failed</h4>
                  <p className="text-sm text-slate-500 max-w-lg break-words">
                    {error}
                  </p>
                </div>
              ) : isSyncing && !apiData ? (
                 <div className="flex-1 flex items-center justify-center py-20">
                   <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                 </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  <div>
                    {/* Column label */}
                    <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200">
                      <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">Column: {selectedTextColumn}</span>
                    </div>
                    <table className="w-full text-sm text-left border-collapse">
                      <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm shadow-slate-200/50">
                        <tr>
                          <th className="px-6 py-3 font-semibold text-slate-700 uppercase tracking-wider text-xs w-1/2 border-r border-slate-200">
                            Raw Input
                          </th>
                          <th className="px-6 py-3 font-semibold text-indigo-700 uppercase tracking-wider text-xs w-1/2 bg-indigo-50/30">
                            Transformed Output
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(transformedByColumn[selectedTextColumn] || []).map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/80 transition-colors group">
                            <td className="px-6 py-3.5 text-slate-500 font-medium border-r border-slate-200 align-top leading-relaxed">
                              {item.raw}
                            </td>
                            <td className="px-6 py-3.5 text-slate-800 font-medium bg-indigo-50/10 align-top leading-relaxed">
                              {item.transformed || <span className="text-slate-300 italic">Empty output...</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Column 3: Data Summary Panel */}
          <div className="w-full lg:w-[280px] shrink-0 bg-slate-50 flex flex-col gap-6">
            
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
              <div className="p-5 border-b border-slate-200 bg-slate-50/50">
                <h3 className="text-base font-semibold text-slate-900">Data Summary</h3>
                <p className="text-sm text-slate-500 mt-0.5">Post-transformation metrics</p>
              </div>

              <div className="p-5 space-y-4 flex-1">
                {/* Cleaned Records */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white flex flex-col gap-1">
                  <div className="text-sm font-medium text-slate-500">Cleaned Records</div>
                  <div className="text-2xl font-bold text-slate-900 tracking-tight">{stats.cleanedRecords}</div>
                </div>

                {/* Vocabulary Size */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white flex flex-col gap-1">
                  <div className="text-sm font-medium text-slate-500">Vocabulary Size</div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-slate-900 tracking-tight">
                      {stats.vocabSize.toLocaleString()}
                    </span>
                    <span className="text-xs font-medium text-slate-400">words</span>
                  </div>
                </div>

                {/* Noise Reduction */}
                <div className="p-4 rounded-xl border border-slate-200 bg-indigo-50 flex flex-col gap-1">
                  <div className="text-sm font-medium text-indigo-800">Noise Reduction</div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-indigo-700 tracking-tight">
                      {stats.noiseReduction}%
                    </span>
                    <span className="text-xs font-medium text-indigo-500">of raw data</span>
                  </div>
                </div>
              </div>

              <div className="p-5 border-t border-slate-200 bg-slate-50 flex flex-col gap-3">
                <button 
                  onClick={handleApplyTransformations}
                  disabled={!hasTextColumn || isApplying}
                  className={`w-full py-3 px-4 rounded-lg text-sm font-semibold transition-colors shadow-sm flex items-center justify-center gap-2 ${
                    hasTextColumn && !isApplying
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-600/20 cursor-pointer'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                  }`}
                >
                  {isApplying ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing All Rows...
                    </>
                  ) : (
                    <>
                      Apply Transformations
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
                <button 
                  onClick={resetConfig}
                  className="w-full py-2.5 px-4 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 hover:text-slate-900 hover:border-slate-400 transition-colors shadow-sm flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset to Raw
                </button>
              </div>
            </div>

          </div>

    </div>
  );
}
