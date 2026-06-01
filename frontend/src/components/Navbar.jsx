import React from 'react';
import { Shield, Bell, UserCircle, Menu, Moon, Sun } from 'lucide-react';
import useStore from '../store/useStore';

export default function Navbar() {
  const toggleSidebar  = useStore((state) => state.toggleSidebar);
  const mapStyle       = useStore((state) => state.mapStyle);
  const toggleMapStyle = useStore((state) => state.toggleMapStyle);
  const activeAlert    = useStore((state) => state.activeAlert);
  const dismissAlert   = useStore((state) => state.dismissAlert);

  return (
    <nav className="h-16 glass-panel flex items-center justify-between px-6 z-50 relative border-b-0">
      <div className="flex items-center gap-4">
        <button 
          onClick={toggleSidebar}
          className="p-2 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
        >
          <Menu className="w-6 h-6 neon-text" />
        </button>
        <div className="flex items-center gap-2">
          <Shield className="w-6 h-6 text-cyan-400" />
          <h1 className="text-xl font-bold tracking-wider neon-text" style={{ textShadow: '0 0 20px rgba(6,182,212,0.4)' }}>HazardMap</h1>
          <span className="text-xs bg-cyan-900/50 text-cyan-400 px-2 py-0.5 rounded border border-cyan-500/40 shadow-[0_0_8px_rgba(6,182,212,0.2)] hover:shadow-[0_0_12px_rgba(6,182,212,0.4)] transition-shadow">
            v1.0.0
          </span>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <button 
          onClick={toggleMapStyle}
          className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
          title={mapStyle === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {mapStyle === 'dark' ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-cyan-400" />}
        </button>
        <button
          className="relative p-2 hover:bg-slate-800 rounded-lg transition-colors"
          onClick={activeAlert ? dismissAlert : undefined}
          title={activeAlert ? `Alert: M${activeAlert.magnitude?.toFixed(1)} — ${activeAlert.place}` : 'No active alerts'}
        >
          <Bell className={`w-5 h-5 ${activeAlert ? 'text-red-400' : 'text-slate-300'}`} />
          {activeAlert && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          )}
        </button>
        <button className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
          <UserCircle className="w-5 h-5 text-slate-300" />
        </button>
      </div>
      {/* Cinematic bottom gradient divider */}
      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
    </nav>
  );
}
