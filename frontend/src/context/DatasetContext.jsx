import React, { createContext, useContext, useState } from 'react';

const DatasetContext = createContext(null);

export function DatasetProvider({ children }) {
  // File metadata (we store name/size/type rather than the File object itself for reliability)
  const [fileInfo, setFileInfo] = useState(null); // { name, size, type }

  // Parsed data from the uploaded file
  const [parsedData, setParsedData] = useState(null); // { columns: string[], rows: object[] }

  // Selected target columns for analysis
  const [selectedColumns, setSelectedColumns] = useState([]);

  // Parse status
  const [parseError, setParseError] = useState(null);

  // Analysis configuration
  const [analysisConfig, setAnalysisConfig] = useState({
    lexicon: 'afinn', // afinn, bing, nrc
    model: 'naive_bayes',
    sensitivity: 50,
    themeCount: 8
  });

  const value = {
    fileInfo,
    setFileInfo,
    parsedData,
    setParsedData,
    selectedColumns,
    setSelectedColumns,
    parseError,
    setParseError,
    analysisConfig,
    setAnalysisConfig,
  };

  return (
    <DatasetContext.Provider value={value}>
      {children}
    </DatasetContext.Provider>
  );
}

export function useDataset() {
  const context = useContext(DatasetContext);
  if (!context) {
    throw new Error('useDataset must be used within a DatasetProvider');
  }
  return context;
}
