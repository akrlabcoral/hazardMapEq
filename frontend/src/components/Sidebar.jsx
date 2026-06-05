import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Layers, Play, Menu } from 'lucide-react';
import useStore from '../store/useStore';

const navItems = [
  { id: 'disasters', icon: Play,          label: 'Earthquake Simulation' },
  { id: 'layers',    icon: Layers,        label: 'Map Layers'            },
  { id: 'alerts',    icon: AlertTriangle, label: 'Alerts'                },
];

export default function Sidebar({ isAdmin = false }) {
  const visibleNavItems = navItems.filter(item => isAdmin || item.id !== 'disasters');

  const isSidebarOpen = useStore((state) => state.isSidebarOpen);
  const toggleSidebar = useStore((state) => state.toggleSidebar);
  const activeSection = useStore((state) => state.activeSection);
  const setActiveSection = useStore((state) => state.setActiveSection);

  const [isHovered, setIsHovered] = useState(false);
  const isExpanded = isSidebarOpen || isHovered;

  return (
    <motion.aside
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      initial={false}
      animate={{ width: isExpanded ? 260 : 72 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="absolute top-0 left-0 bottom-0 glass-panel z-50 border-t-0 border-l-0 flex flex-col overflow-visible"
    >
      <div className="p-3 flex items-center border-b border-slate-800/80 bg-slate-900/50">
        <button 
          onClick={toggleSidebar}
          className="w-12 h-12 flex items-center justify-center hover:bg-slate-800 rounded-lg text-slate-300 hover:text-cyan-400 transition-colors shrink-0"
          title="Toggle Sidebar"
        >
          <Menu size={20} strokeWidth={2} />
        </button>
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="ml-2 font-bold text-slate-200 tracking-wider whitespace-nowrap overflow-hidden"
            >
              HAZARD<span className="text-cyan-400">MAP</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="p-3 flex-1 overflow-y-auto space-y-1 overflow-x-hidden">
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <div key={item.id} className="relative group/navitem">
              <button
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center h-12 rounded-lg transition-all duration-300 relative ${
                  isActive 
                    ? 'bg-cyan-900/30 text-cyan-400 shadow-[inset_0_0_15px_rgba(6,182,212,0.2)]' 
                    : 'hover:bg-slate-800/50 text-slate-400 hover:text-slate-200'
                }`}
              >
                {isActive && (
                  <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.6)]" />
                )}
                
                <div className="shrink-0 flex items-center justify-center w-12 h-12">
                  <Icon className={`w-5 h-5 ${isActive ? 'drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]' : ''}`} strokeWidth={2} />
                </div>
                
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      className="ml-2 font-medium tracking-wide text-left overflow-hidden whitespace-nowrap"
                    >
                      {item.label}
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>

              {/* Tooltip for collapsed state */}
              {!isExpanded && (
                <div className="absolute left-[80px] top-1/2 -translate-y-1/2 px-3 py-1.5 bg-slate-800 text-slate-200 text-xs font-semibold rounded shadow-lg border border-slate-700 opacity-0 group-hover/navitem:opacity-100 pointer-events-none transition-opacity duration-200 z-50 whitespace-nowrap">
                  {item.label}
                  <div className="absolute top-1/2 -left-1 -translate-y-1/2 border-t-4 border-b-4 border-r-4 border-t-transparent border-b-transparent border-r-slate-800"></div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="p-3 border-t border-slate-800/80 bg-slate-900/50 relative overflow-hidden">
        <div className="absolute top-0 left-3 right-3 h-[1px] bg-gradient-to-r from-transparent via-cyan/30 to-transparent" />
        <AnimatePresence mode="wait">
          {isExpanded ? (
            <motion.div
              key="expanded-footer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-xs text-slate-500 text-center whitespace-nowrap"
            >
              HazardMap · GIS Hazard Platform
            </motion.div>
          ) : (
            <motion.div
              key="collapsed-footer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-[10px] text-slate-500 text-center font-mono whitespace-nowrap"
            >
              HM
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.aside>
  );
}
