import React, { useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDataset } from '../context/DatasetContext';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import {
  UploadCloud,
  FileText,
  BarChart3,
  Settings,
  Bell,
  Database,
  AlertCircle,
  Globe,
  Info,
  Sliders,
  Activity,
  PieChart,
  X,
  Loader2
} from 'lucide-react';
import frankfurtImg from '../assets/Frankfurt_University.png';



export default function IngestionPage() {
  // Persistent state from context (survives navigation)
  const {
    fileInfo, setFileInfo,
    parsedData, setParsedData,
    selectedColumns, setSelectedColumns,
    parseError, setParseError,
  } = useDataset();

  // Local-only ephemeral state
  const [currentDropdownValue, setCurrentDropdownValue] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  // Decide which data to show: uploaded or empty
  const displayColumns = parsedData ? parsedData.columns : [];
  const displayRows = parsedData ? parsedData.rows : [];

  // Pagination
  const PAGE_SIZE = 50;
  const totalPages = Math.max(1, Math.ceil(displayRows.length / PAGE_SIZE));
  const startIdx = currentPage * PAGE_SIZE;
  const endIdx = Math.min(startIdx + PAGE_SIZE, displayRows.length);
  const pageRows = displayRows.slice(startIdx, endIdx);

  // Compute insights dynamically
  const insights = useMemo(() => {
    const totalRecords = displayRows.length;

    // Count missing/empty values
    let missingCount = 0;
    const totalCells = totalRecords * displayColumns.length;
    displayRows.forEach(row => {
      displayColumns.forEach(col => {
        const val = row[col];
        if (val === null || val === undefined || val === '') {
          missingCount++;
        }
      });
    });
    const missingPercent = totalCells > 0 ? ((missingCount / totalCells) * 100).toFixed(2) : '0.00';

    // Simple language "detection" — check if most text looks like English
    // We find the first text-like column and sample it
    let detectedLanguage = 'English';
    let langConfidence = '98%';
    const textCol = displayColumns.find(col => {
      const sample = displayRows.slice(0, 5).map(r => String(r[col] || ''));
      return sample.some(s => s.length > 15);
    });
    if (textCol) {
      const sample = displayRows.slice(0, 20).map(r => String(r[textCol] || ''));
      const englishPattern = /^[a-zA-Z0-9\s.,!?'"()\-:;@#$%&*+/=\[\]{}|\\<>~`^_]+$/;
      const matches = sample.filter(s => englishPattern.test(s)).length;
      const pct = Math.round((matches / sample.length) * 100);
      if (pct > 60) {
        detectedLanguage = 'English';
        langConfidence = `${pct}% match`;
      } else {
        detectedLanguage = 'Mixed / Unknown';
        langConfidence = `${pct}% English`;
      }
    }

    return { totalRecords, missingCount, missingPercent, detectedLanguage, langConfidence };
  }, [displayRows, displayColumns]);

  // Filter columns to only those containing text data (at least one letter in values)
  const textColumns = useMemo(() => {
    return displayColumns.filter(col => {
      // Sample up to 20 non-empty values from this column
      const samples = displayRows
        .slice(0, Math.min(displayRows.length, 50))
        .map(row => row[col])
        .filter(val => val !== null && val !== undefined && String(val).trim() !== '');

      if (samples.length === 0) return false;

      // A column is "text" if at least 30% of sampled values contain a letter
      const withLetters = samples.filter(val => /[a-zA-Z]/.test(String(val)));
      return (withLetters.length / samples.length) >= 0.3;
    });
  }, [displayColumns, displayRows]);

  const handleAddColumn = (column) => {
    if (column && !selectedColumns.includes(column)) {
      setSelectedColumns([...selectedColumns, column]);
      setCurrentDropdownValue('');
    }
  };

  const handleRemoveColumn = (columnToRemove) => {
    setSelectedColumns(selectedColumns.filter(col => col !== columnToRemove));
  };

  const processFile = (file) => {
    setFileInfo({ name: file.name, size: file.size, type: file.type });
    setIsParsing(true);
    setParseError(null);
    setSelectedColumns([]); // reset column selection for new file
    setCurrentPage(0); // reset pagination for new file

    const extension = file.name.split('.').pop().toLowerCase();

    if (extension === 'csv' || extension === 'tsv') {
      // Parse CSV/TSV with PapaParse
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        delimiter: extension === 'tsv' ? '\t' : undefined,
        complete: (results) => {
          if (results.data && results.data.length > 0) {
            const columns = results.meta.fields || Object.keys(results.data[0]);
            setParsedData({ columns, rows: results.data });
          } else {
            setParseError('The file appears to be empty.');
          }
          setIsParsing(false);
        },
        error: (err) => {
          setParseError(`CSV parse error: ${err.message}`);
          setIsParsing(false);
        }
      });
    } else if (extension === 'xlsx' || extension === 'xls') {
      // Parse Excel with SheetJS
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const workbook = XLSX.read(e.target.result, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });
          if (jsonData.length > 0) {
            const columns = Object.keys(jsonData[0]);
            setParsedData({ columns, rows: jsonData });
          } else {
            setParseError('The Excel sheet appears to be empty.');
          }
        } catch (err) {
          setParseError(`Excel parse error: ${err.message}`);
        }
        setIsParsing(false);
      };
      reader.onerror = () => {
        setParseError('Failed to read file.');
        setIsParsing(false);
      };
      reader.readAsArrayBuffer(file);
    } else if (extension === 'json') {
      // Parse JSON
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const jsonData = JSON.parse(e.target.result);
          const arr = Array.isArray(jsonData) ? jsonData : [jsonData];
          if (arr.length > 0) {
            const columns = Object.keys(arr[0]);
            setParsedData({ columns, rows: arr });
          } else {
            setParseError('The JSON file appears to be empty.');
          }
        } catch (err) {
          setParseError(`JSON parse error: ${err.message}`);
        }
        setIsParsing(false);
      };
      reader.onerror = () => {
        setParseError('Failed to read file.');
        setIsParsing(false);
      };
      reader.readAsText(file);
    } else {
      setParseError(`Unsupported file type: .${extension}`);
      setIsParsing(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) processFile(file);
    // Reset so the same file can be re-selected (e.g. after edits in Excel)
    e.target.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  // Build dynamic grid template based on column count
  const gridTemplate = displayColumns.map(() => 'minmax(120px, 1fr)').join(' ');

  return (
    <div className="flex h-full w-full bg-slate-50 overflow-hidden font-sans">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept=".csv,.xlsx,.xls,.tsv,.json"
        className="hidden"
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-50/50">

        {/* Content Body */}
        <div className="flex-1 p-8 overflow-hidden flex flex-col gap-4">
          {/* Upload Dataset Section - Compact */}
          <div
            className="shrink-0 border border-slate-200 rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={handleDrop}
          >
            <div className="flex items-center gap-4 px-6 py-3.5">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg shrink-0 group-hover:bg-indigo-100 transition-colors">
                {isParsing ? <Loader2 className="w-5 h-5 animate-spin" /> : <UploadCloud className="w-5 h-5" />}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-900">
                  {isParsing ? 'Parsing file...' : fileInfo ? fileInfo.name : 'Upload Dataset'}
                </p>
                <p className="text-xs text-slate-500">
                  {isParsing
                    ? 'Please wait while we process your data'
                    : fileInfo
                      ? `${(fileInfo.size / (1024 * 1024)).toFixed(2)} MB — ${fileInfo.type || 'Unknown type'}`
                      : 'Drag & drop CSV or Excel file, or click to browse (Max: 10GB)'}
                </p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
              >
                Browse Files
              </button>
            </div>
          </div>

          {/* Parse Error Banner */}
          {parseError && (
            <div className="shrink-0 flex items-center gap-3 px-5 py-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {parseError}
            </div>
          )}

          {/* Dataset Preview Table - Expanded */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 flex flex-col min-h-0">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-white shrink-0">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Dataset Preview</h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  {parsedData
                    ? `Showing ${startIdx + 1}–${endIdx} of ${displayRows.length.toLocaleString()} records — ${displayColumns.length} columns`
                    : 'Review your uploaded data'}
                </p>
              </div>
              {parsedData && (
                <span className="text-xs font-medium px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-md border border-emerald-100">
                  Live Data
                </span>
              )}
            </div>
            <div className="overflow-auto flex-1 relative">
              {displayColumns.length > 0 ? (
              <div className="min-w-[800px] w-full text-sm text-left flex flex-col">
                <div
                  className="text-xs text-slate-500 bg-slate-50/90 backdrop-blur-sm sticky top-0 z-10 shadow-sm shadow-slate-200/50"
                  style={{ display: 'grid', gridTemplateColumns: gridTemplate }}
                >
                  {displayColumns.map((col) => (
                    <div key={col} className="px-6 py-4 font-medium border-b border-slate-200 whitespace-nowrap">
                      <div className="font-semibold text-slate-800 uppercase tracking-wider text-xs">
                        {col}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-col divide-y divide-slate-100">
                  {pageRows.map((row, i) => (
                    <div
                      key={i}
                      className="hover:bg-slate-50/80 transition-colors group"
                      style={{ display: 'grid', gridTemplateColumns: gridTemplate }}
                    >
                      {displayColumns.map(col => (
                        <div key={col} className="px-6 py-3.5 text-slate-600 group-hover:text-slate-900 transition-colors truncate pr-4">
                          {row[col] !== null && row[col] !== undefined ? String(row[col]) : ''}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
                  <div className="p-4 bg-slate-100 rounded-full mb-4">
                    <UploadCloud className="w-8 h-8 text-slate-400" />
                  </div>
                  <h4 className="text-base font-semibold text-slate-700 mb-1">No dataset loaded</h4>
                  <p className="text-sm text-slate-500 max-w-xs">Upload a CSV, Excel, or JSON file above to preview your data here.</p>
                </div>
              )}
            </div>
            <div className="px-6 py-3 border-t border-slate-200 flex items-center justify-between bg-slate-50/50 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  Showing {displayRows.length > 0 ? startIdx + 1 : 0}–{endIdx} of {displayRows.length.toLocaleString()} records
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400">
                  Page {currentPage + 1} of {totalPages}
                </span>
                <button
                  disabled={currentPage === 0}
                  onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                  className="p-2 hover:bg-white rounded-lg border border-slate-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  disabled={currentPage >= totalPages - 1}
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
        </div>
      </main>

      {/* Right Sidebar: Data Insights */}
      <aside className="w-80 border-l border-slate-200 bg-white flex flex-col shrink-0 shadow-sm z-10 relative">
        <div className="p-6 border-b border-slate-200 bg-slate-50/50">
          <h2 className="text-base font-semibold text-slate-900 tracking-tight">Data Insights</h2>
          <p className="text-sm text-slate-500 mt-1">Configure analysis parameters</p>
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col">
          <div className="p-6 space-y-6 flex-1">
            {/* Stats Cards */}
            <div className="space-y-4">
              {/* Total Records */}
              <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex items-start gap-4 hover:border-indigo-200 transition-colors">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg shrink-0">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-500 mb-1">Total Records</div>
                  <div className="text-2xl font-bold text-slate-900 tracking-tight">
                    {insights.totalRecords.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Detected Language */}
              <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex items-start gap-4 hover:border-green-200 transition-colors">
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg shrink-0">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-500 mb-1">Detected Language</div>
                  <div className="text-lg font-bold text-slate-900">
                    {insights.detectedLanguage}
                    <span className="text-xs text-emerald-600 font-medium ml-2 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                      {insights.langConfidence}
                    </span>
                  </div>
                </div>
              </div>

              {/* Missing Values */}
              <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex items-start gap-4 hover:border-amber-200 transition-colors">
                <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-500 mb-1">Missing Values</div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-slate-900 tracking-tight">
                      {insights.missingCount.toLocaleString()}
                    </span>
                    <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                      {insights.missingPercent}% of total
                    </span>
                  </div>
                </div>
              </div>

              {/* Columns Count (new) */}
              <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex items-start gap-4 hover:border-violet-200 transition-colors">
                <div className="p-2.5 bg-violet-50 text-violet-600 rounded-lg shrink-0">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-500 mb-1">Columns Detected</div>
                  <div className="text-2xl font-bold text-slate-900 tracking-tight">
                    {displayColumns.length}
                  </div>
                </div>
              </div>
            </div>

            {/* Select Target Columns */}
            <div className="pt-6 border-t border-slate-200">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-slate-900">Select Target Columns</h3>
                <p className="text-xs text-slate-500 mt-1">
                  {selectedColumns.length === 0
                    ? `${textColumns.length} text ${textColumns.length === 1 ? 'column' : 'columns'} available`
                    : `${selectedColumns.length} ${selectedColumns.length === 1 ? 'column' : 'columns'} selected`}
                </p>
              </div>

              <div className="space-y-4">
                <div className="relative">
                  <select
                    value={currentDropdownValue}
                    onChange={(e) => {
                      const value = e.target.value;
                      setCurrentDropdownValue(value);
                      handleAddColumn(value);
                    }}
                    className="w-full bg-white border border-slate-300 text-slate-700 rounded-lg py-2.5 px-3.5 text-sm focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none cursor-pointer shadow-sm appearance-none hover:border-slate-400 transition-colors"
                  >
                    <option value="">Select text columns for analysis...</option>
                    {textColumns.filter(col => !selectedColumns.includes(col)).map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {selectedColumns.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedColumns.map(col => (
                      <div
                        key={col}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium border border-indigo-200 hover:bg-indigo-200 transition-colors"
                      >
                        <span>{col}</span>
                        <button
                          onClick={() => handleRemoveColumn(col)}
                          className="hover:bg-indigo-300 rounded-full p-0.5 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action Button - Pinned to Bottom */}
          <div className="p-6 border-t border-slate-200 bg-white">
            <button
              onClick={() => navigate('/preprocessing')}
              disabled={selectedColumns.length === 0}
              className={`w-full py-3 px-4 rounded-lg text-sm font-semibold transition-all duration-200 shadow-sm ${
                selectedColumns.length > 0
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-indigo-600/20 shadow-md cursor-pointer'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200 opacity-60'
              }`}
            >
              Proceed to Analysis
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
