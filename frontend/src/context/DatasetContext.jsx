import React, { createContext, useContext, useState } from 'react';

const DatasetContext = createContext(null);

export function DatasetProvider({ children }) {
  // File metadata (we store name/size/type rather than the File object itself for reliability)
  const [fileInfo, setFileInfo] = useState(null); // { name, size, type }

  // Parsed data from the uploaded file
  const [parsedData, setParsedData] = useState(null); // { columns: string[], rows: object[] }

  // Selected text column for preprocessing (single string)
  const [selectedTextColumn, setSelectedTextColumn] = useState('');

  // Selected label column for ML model training (single string, optional)
  const [labelColumn, setLabelColumn] = useState('');

  // Parse status
  const [parseError, setParseError] = useState(null);

  // Analysis configuration
  const [analysisConfig, setAnalysisConfig] = useState({
    lexicon: 'afinn', // afinn, bing, nrc
    model: 'naive_bayes',
    sensitivity: 50,
    themeCount: 8
  });

  // Final analyzed data
  const [analysisResults, setAnalysisResults] = useState(null);

  const value = {
    fileInfo,
    setFileInfo,
    parsedData,
    setParsedData,
    selectedTextColumn,
    setSelectedTextColumn,
    labelColumn,
    setLabelColumn,
    parseError,
    setParseError,
    analysisConfig,
    setAnalysisConfig,
    analysisResults,
    setAnalysisResults,
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

