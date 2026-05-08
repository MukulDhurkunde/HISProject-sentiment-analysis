import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { DatasetProvider } from './context/DatasetContext';
import LoginPage from './pages/LoginPage';
import IngestionPage from './pages/IngestionPage';
import PreprocessingPage from './pages/PreprocessingPage';
import AnalysisEnginePage from './pages/AnalysisPage';
import InsightsDashboardPage from './pages/DashboardPage';
import MainLayout from './layouts/MainLayout';

function App() {
  return (
    <BrowserRouter>
      <DatasetProvider>
        <Routes>
          {/* Public Route */}
          <Route path="/" element={<LoginPage />} />

          {/* Protected Routes wrapped in MainLayout */}
          <Route element={<MainLayout />}>
            <Route path="/ingestion" element={<IngestionPage />} />
            <Route path="/preprocessing" element={<PreprocessingPage />} />
            <Route path="/analysis" element={<AnalysisEnginePage />} />
            <Route path="/dashboard" element={<InsightsDashboardPage />} />
          </Route>
        </Routes>
      </DatasetProvider>
    </BrowserRouter>
  );
}

export default App;

