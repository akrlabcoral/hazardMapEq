import React, { useState } from 'react';
import { Shield, Bell, Earth, UserCircle, Menu, Moon, Sun } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import useStore from '../store/useStore';

export default function Navbar({ isAdmin = true }) {
  const mapStyle       = useStore((state) => state.mapStyle);
  const toggleMapStyle = useStore((state) => state.toggleMapStyle);
  const activeAlert    = useStore((state) => state.activeAlert);
  const dismissAlert   = useStore((state) => state.dismissAlert);
  const liveEvents     = useStore((state) => state.liveEvents || []);
  const forceActiveSection = useStore((state) => state.forceActiveSection);

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  return (
    <nav className="h-16 glass-panel flex items-center justify-between px-6 z-50 relative border-b-0">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Earth className="w-6 h-6 text-white" />
          <h1 className="text-xl font-bold tracking-wider neon-text" >HazardMap</h1>
          
        </div>
      </div>

      <div className="flex items-center gap-6">
        <button 
          onClick={toggleMapStyle}
          className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
          title={mapStyle === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {mapStyle === 'dark' ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-white" />}
        </button>
        <div className="relative">
          <button
            className={`relative p-2 rounded-lg transition-colors ${isDropdownOpen ? 'bg-slate-800' : 'hover:bg-slate-800'}`}
            onClick={() => {
              if (activeAlert) dismissAlert();
              setIsDropdownOpen(!isDropdownOpen);
            }}
            title={activeAlert ? `Alert: M${activeAlert.magnitude?.toFixed(1)} — ${activeAlert.place}` : 'Notifications'}
          >
            <Bell className={`w-5 h-5 ${activeAlert ? 'text-red-400' : 'text-slate-300'}`} />
            {activeAlert && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            )}
          </button>

          <AnimatePresence>
            {isDropdownOpen && (
              <>
                {/* Invisible backdrop to catch outside clicks */}
                <div 
                  className="fixed inset-0 z-40"
                  onClick={() => setIsDropdownOpen(false)}
                />
                
                {/* Dropdown Menu */}
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className="absolute right-0 mt-2 w-80 bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl z-50 overflow-hidden backdrop-blur-md"
                >
                  {(() => {
                    const relevantEvents = liveEvents.filter(e => e.is_relevant || e.tsunami_warning?.is_warning);
                    return (
                      <>
                        <div className="px-4 py-3 border-b border-slate-700/50 bg-slate-800/40 flex justify-between items-center">
                          <span className="text-sm font-bold text-slate-200">Recent Notifications</span>
                          {relevantEvents.length > 0 && (
                            <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">
                              {relevantEvents.length}
                            </span>
                          )}
                        </div>
                        
                        <div className="max-h-[320px] overflow-y-auto">
                          {relevantEvents.length === 0 ? (
                            <div className="px-4 py-8 text-center text-slate-500 text-sm">
                              No live events captured
                            </div>
                          ) : (
                            <div className="flex flex-col">
                              {relevantEvents.slice(0, 5).map((event) => {
                          const mag = event.magnitude ?? 0;
                          const isTsunami = Boolean(event.tsunami_warning?.is_warning);
                          const isMajor = mag >= 5.0;
                          
                          return (
                            <button
                              key={event.id || Math.random()}
                              className="text-left px-4 py-3 border-b border-slate-700/30 hover:bg-slate-800/60 transition-colors flex flex-col gap-1 last:border-0"
                              onClick={() => {
                                setIsDropdownOpen(false);
                                forceActiveSection('live_events');
                              }}
                            >
                              <div className="flex items-center justify-between">
                                <span className={`font-bold text-sm ${isTsunami ? 'text-sky-400' : isMajor ? 'text-red-400' : 'text-orange-400'}`}>
                                  {isTsunami ? 'TSUNAMI' : `M ${mag.toFixed(1)}`}
                                </span>
                                <span className="text-xs text-slate-500">
                                  {event.time ? new Date(event.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                                </span>
                              </div>
                              <span className="text-xs text-slate-300 truncate" title={event.place}>
                                {isTsunami ? `M ${mag.toFixed(1)} — ${event.place || 'Bay of Bengal'}` : event.place || 'Unknown location'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  
                  {relevantEvents.length > 0 && (
                    <div className="p-2 border-t border-slate-700/50 bg-slate-800/20">
                      <button 
                        className="w-full py-1.5 text-xs text-center text-cyan-400 hover:text-cyan-300 hover:bg-slate-800 rounded transition-colors font-semibold"
                        onClick={() => {
                          setIsDropdownOpen(false);
                          forceActiveSection('live_events');
                        }}
                      >
                        View all events
                      </button>
                    </div>
                  )}
                      </>
                    );
                  })()}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
        
      </div>
      {/* Cinematic bottom gradient divider */}
      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
    </nav>
  );
}
