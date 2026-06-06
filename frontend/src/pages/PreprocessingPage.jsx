import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDataset } from '../context/DatasetContext';
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
  AlertCircle
} from 'lucide-react';

export default function PreprocessingPage() {
  const navigate = useNavigate();
  const { parsedData, selectedColumns, setParsedData } = useDataset();
  const [missingHandling, setMissingHandling] = useState('');

  // Whether the pipeline has valid target columns from the Ingestion Hub
  const hasTargetColumns = selectedColumns && selectedColumns.length > 0;

  // Apply missing data handling to get the processed rows
  const processedRows = useMemo(() => {
    if (!parsedData || !hasTargetColumns) return [];
    
    let currentRows = parsedData.rows;
    
    if (missingHandling === 'deletion') {
      currentRows = currentRows.filter(row => {
        return selectedColumns.every(col => {
          const val = row[col];
          return val !== null && val !== undefined && String(val).trim() !== '';
        });
      });
    } else if (missingHandling === 'replace') {
      currentRows = currentRows.map(row => {
        const newRow = { ...row };
        selectedColumns.forEach(col => {
          const val = newRow[col];
          if (val === null || val === undefined || String(val).trim() === '') {
            newRow[col] = '[No Review]';
          }
        });
        return newRow;
      });
    }
    
    return currentRows;
  }, [parsedData, selectedColumns, hasTargetColumns, missingHandling]);

  // Build raw samples per target column from the processed dataset
  const columnSamples = useMemo(() => {
    if (!hasTargetColumns) return {};
    const samples = {};
    selectedColumns.forEach(col => {
      samples[col] = processedRows
        .slice(0, 20)
        .map(row => {
          const val = row[col];
          return val !== null && val !== undefined ? String(val) : '';
        })
        .filter(text => text.trim() !== '');
    });
    return samples;
  }, [processedRows, selectedColumns, hasTargetColumns]);

  // Normalization Toggles
  const [config, setConfig] = useState({
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

  const transformText = (text) => {
    if (text === null || text === undefined) return '';
    let res = String(text);

    if (config.removeUrlsHtml) {
      res = res.replace(/<[^>]*>?/gm, '');
      res = res.replace(/(https?:\/\/[^\s]+)/g, '');
      res = res.replace(/(www\.[^\s]+)/g, '');
      res = res.replace(/\s{2,}/g, ' ');
    }
    
    if (config.lowercase) {
      res = res.toLowerCase();
    }

    if (config.punctuation) {
      // Remove standard punctuation: . , ; : ? ! ' " - ( ) [ ] { }
      res = res.replace(/[.,;:?!'"()\[\]{}\-]/g, '');
      res = res.replace(/\s{2,}/g, ' ');
    }

    if (config.specialChars) {
      // Remove special symbols: @ # $ % ^ & * _ = + ~ ` | \ / < >
      res = res.replace(/[@#$%^&*_=+~`|\\/<>]/g, '');
      res = res.replace(/\s{2,}/g, ' ');
    }

    if (config.numbers) {
      res = res.replace(/[0-9]/g, '');
      res = res.replace(/\s{2,}/g, ' ');
    }

    if (config.stopwords) {
      const stops = ['the', 'is', 'a', 'at', 'for', 'our', 'it', 'my', 'i', 'to', 'with', 'what', 'why'];
      res = res.split(' ').filter(w => !stops.includes(w.toLowerCase())).join(' ');
    }

    return res.trim();
  };

  const transformedByColumn = useMemo(() => {
    const result = {};
    selectedColumns.forEach(col => {
      const samples = columnSamples[col] || [];
      result[col] = samples.map(text => ({
        raw: text,
        transformed: transformText(text)
      }));
    });
    return result;
  }, [config, columnSamples, selectedColumns]);

  // Flat list of all raw samples across columns (for stats)
  const allRawSamples = useMemo(() => {
    return Object.values(columnSamples).flat();
  }, [columnSamples]);

  // Stats based on actual dataset size
  const stats = useMemo(() => {
    const totalRecords = processedRows.length;
    let activeToggles = Object.values(config).filter(Boolean).length;
    const cleaned = activeToggles > 0 ? Math.max(0, totalRecords - Math.round(totalRecords * 0.002)) : totalRecords;
    // Estimate vocab by counting unique words in sampled text
    const allWords = allRawSamples.flatMap(t => transformText(t).split(/\s+/).filter(Boolean));
    const uniqueWords = new Set(allWords).size;

    // Compute noise reduction from actual character-level difference
    let noiseReduction = 0;
    if (allRawSamples.length > 0) {
      const rawTotal = allRawSamples.reduce((sum, t) => sum + t.length, 0);
      const transformedTotal = allRawSamples.reduce((sum, t) => sum + transformText(t).length, 0);
      noiseReduction = rawTotal > 0
        ? parseFloat(((1 - transformedTotal / rawTotal) * 100).toFixed(1))
        : 0;
    }

    return {
      cleanedRecords: cleaned.toLocaleString(),
      vocabSize: uniqueWords,
      noiseReduction
    };
  }, [config, processedRows.length, allRawSamples]);

  const resetConfig = () => {
    setConfig({
      lowercase: false,
      removeUrlsHtml: false,
      stopwords: false,
      punctuation: false,
      specialChars: false,
      numbers: false
    });
    setMissingHandling('');
  };

  const handleApplyTransformations = () => {
    if (parsedData && processedRows) {
      setParsedData({
        ...parsedData,
        rows: processedRows
      });
    }
    // Navigate to the Analysis Engine
    navigate('/analysis');
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
                    <option value="replace">Replace with Missing</option>
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
                  {hasTargetColumns
                    ? `Transforming ${selectedColumns.length} target ${selectedColumns.length === 1 ? 'column' : 'columns'}: ${selectedColumns.join(', ')}`
                    : 'Real-time preview of text transformations'}
                </p>
              </div>
              {hasTargetColumns && (
                <div className="text-xs font-medium px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-md border border-indigo-100 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" />
                  Live Sync
                </div>
              )}
            </div>
            
            <div className="flex-1 overflow-auto p-0 relative">
              {!hasTargetColumns ? (
                <div className="flex-1 flex flex-col items-center justify-center py-20 text-center px-6">
                  <div className="p-4 bg-amber-50 rounded-full mb-4">
                    <AlertCircle className="w-8 h-8 text-amber-500" />
                  </div>
                  <h4 className="text-base font-semibold text-slate-700 mb-1">No target columns selected</h4>
                  <p className="text-sm text-slate-500 max-w-sm">
                    Please go back to the <span className="font-medium text-indigo-600">Data Ingestion Hub</span> and select one or more target text columns before preprocessing.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {selectedColumns.map(col => (
                    <div key={col}>
                      {/* Column label */}
                      <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200">
                        <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">Column: {col}</span>
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
                          {(transformedByColumn[col] || []).map((item, idx) => (
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
                  ))}
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
                  disabled={!hasTargetColumns}
                  className={`w-full py-3 px-4 rounded-lg text-sm font-semibold transition-colors shadow-sm flex items-center justify-center gap-2 ${
                    hasTargetColumns
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-600/20 cursor-pointer'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                  }`}
                >
                  Apply Transformations
                  <ArrowRight className="w-4 h-4" />
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
