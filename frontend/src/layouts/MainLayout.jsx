import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { Bell } from 'lucide-react';

export default function MainLayout() {
  const location = useLocation();

  const getPageTitle = () => {
    switch (location.pathname) {
      case '/preprocessing':
        return (
          <div>
            <h2 className="text-xl font-semibold text-slate-800 tracking-tight">Pre-Processing Hub</h2>
            <p className="text-sm text-slate-500">Data Transformation &amp; Cleaning</p>
          </div>
        );
      case '/ingestion':
        return (
          <div>
            <h2 className="text-xl font-semibold text-slate-800 tracking-tight">Data Ingestion Hub</h2>
          </div>
        );
      case '/analysis':
        return (
          <div>
            <h2 className="text-xl font-semibold text-slate-800 tracking-tight">Sentiment Analysis Engine</h2>
            <p className="text-sm text-slate-500">Configure and execute statistical modeling</p>
          </div>
        );
      case '/dashboard':
        return (
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-slate-800 tracking-tight">Insights Dashboard</h2>
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold border border-indigo-200">Live Results</span>
          </div>
        );
      default:
        return (
          <div>
            <h2 className="text-xl font-semibold text-slate-800 tracking-tight">Sentiment Analyzer</h2>
          </div>
        );
    }
  };

  return (
    <div className="flex h-screen bg-[#f8fafc]">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0 z-10">
          {getPageTitle()}
          <div className="flex items-center gap-5 text-slate-500">
            <button className="hover:text-slate-900 transition-colors relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-0 right-0 w-2 h-2 bg-indigo-500 rounded-full border border-white"></span>
            </button>
            <div className="flex items-center gap-3 pl-5 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm shadow-inner shadow-indigo-200/50">
                JD
              </div>
              <span className="text-sm font-medium text-slate-700 hidden sm:block">Jane Doe</span>
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
