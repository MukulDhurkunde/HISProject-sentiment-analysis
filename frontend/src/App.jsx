import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { DatasetProvider } from './context/DatasetContext';
import LoginPage from './pages/LoginPage';
import IngestionPage from './pages/IngestionPage';
import PreprocessingPage from './pages/PreprocessingPage';
import AnalysisEnginePage from './pages/AnalysisPage';
import InsightsDashboardPage from './pages/DashboardPage';
import MainLayout from './layouts/MainLayout';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <DatasetProvider>
          <Routes>
            {/* Public Route */}
            <Route path="/" element={<LoginPage />} />

            {/* Protected Routes wrapped in MainLayout */}
            <Route
              element={
                <ProtectedRoute>
                  <MainLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/ingestion" element={<IngestionPage />} />
              <Route path="/preprocessing" element={<PreprocessingPage />} />
              <Route path="/analysis" element={<AnalysisEnginePage />} />
              <Route path="/dashboard" element={<InsightsDashboardPage />} />
            </Route>
          </Routes>
        </DatasetProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
