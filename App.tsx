import React from 'react';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import MobileRegister from './components/MobileRegister';
import DesktopDashboard from './components/DesktopDashboard';
import { Smartphone, Monitor, ChevronRight } from 'lucide-react';

const Navigation = () => {
  const location = useLocation();
  
  if (location.pathname === '/' || location.pathname === '') {
     return (
       <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden bg-slate-900">
         {/* Background Effects */}
         <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-800 via-slate-900 to-black"></div>
         <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-500/30 rounded-full blur-[100px] animate-blob"></div>
         <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-purple-500/30 rounded-full blur-[100px] animate-blob animation-delay-2000"></div>

         <div className="z-10 text-center mb-16">
            <h1 className="text-6xl font-bold mb-6 text-white tracking-tight">
              WhatsDoc <span className="text-blue-500">Flow</span>
            </h1>
            <p className="text-slate-400 text-xl font-light max-w-lg mx-auto leading-relaxed">
              Enterprise-grade document automation for WhatsApp.
            </p>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl z-10">
           
           <Link to="/register" className="group relative bg-white/5 backdrop-blur-lg p-8 rounded-3xl border border-white/10 hover:border-blue-500/50 hover:bg-white/10 transition-all duration-300">
              <div className="flex items-start justify-between mb-8">
                <div className="p-4 bg-blue-500/20 rounded-2xl">
                   <Smartphone className="w-8 h-8 text-blue-400" />
                </div>
                <ChevronRight className="w-6 h-6 text-slate-600 group-hover:text-blue-400 transition-colors" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-white mb-2">Mobile Portal</h2>
                <p className="text-slate-400 font-light">Customer registration interface.</p>
              </div>
           </Link>

           <Link to="/admin" className="group relative bg-white/5 backdrop-blur-lg p-8 rounded-3xl border border-white/10 hover:border-purple-500/50 hover:bg-white/10 transition-all duration-300">
              <div className="flex items-start justify-between mb-8">
                <div className="p-4 bg-purple-500/20 rounded-2xl">
                   <Monitor className="w-8 h-8 text-purple-400" />
                </div>
                <ChevronRight className="w-6 h-6 text-slate-600 group-hover:text-purple-400 transition-colors" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-white mb-2">Admin Hub</h2>
                <p className="text-slate-400 font-light">Document matching dashboard.</p>
              </div>
           </Link>

         </div>
         
         <div className="absolute bottom-8 text-slate-600 text-sm">
           System Active • n8n Connected
         </div>
       </div>
     );
  }
  return null;
};

const App: React.FC = () => {
  return (
    <HashRouter>
      <Navigation />
      <Routes>
        <Route path="/register" element={<MobileRegister />} />
        <Route path="/admin" element={<DesktopDashboard />} />
      </Routes>
    </HashRouter>
  );
};

export default App;