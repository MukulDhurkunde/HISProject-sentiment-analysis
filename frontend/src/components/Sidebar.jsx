import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Database, Sliders, Activity, PieChart, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import frankfurtImg from '../assets/Frankfurt_University.png';

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const menuItems = [
    { path: '/ingestion', name: 'Data Ingestion', icon: Database },
    { path: '/preprocessing', name: 'Pre-Processing', icon: Sliders },
    { path: '/analysis', name: 'Analysis Engine', icon: Activity },
    { path: '/dashboard', name: 'Insights Dashboard', icon: PieChart },
  ];

  const handleLogout = () => {
    logout();
    window.location.href = '/';
  };

  return (
    <aside className="w-64 bg-slate-900 flex flex-col h-full border-r border-slate-800 shrink-0">
      <div className="p-6 border-b border-slate-800/50">
        <div className="flex items-center gap-3 mb-2">
          <img 
            src={frankfurtImg} 
            alt="Frankfurt University" 
            className="w-10 h-10 rounded-lg object-contain ring-2 ring-indigo-500/30" 
          />
          <div>
            <h1 className="text-base font-bold text-white tracking-tight leading-tight">Sentiment<br/>Analyzer</h1>
          </div>
        </div>
        <p className="text-xs text-indigo-400 font-medium mt-2">Frankfurt University</p>
      </div>
      
      <div className="flex-1 py-6 overflow-y-auto">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-6">NAVIGATION</div>
        <nav className="space-y-1 px-3">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link 
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm transition-colors ${
                  isActive 
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto p-4 border-t border-slate-800/50">
        <button 
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors font-medium text-sm"
        >
          <LogOut className="w-4 h-4" />
          Log out
        </button>
      </div>
    </aside>
  );
}