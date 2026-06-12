import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Menu, Waves } from 'lucide-react';
import useStore from '../store/useStore';

export default function RightSidebar({ isAdmin = true }) {
  const isRightSidebarOpen = useStore((state) => state.isRightSidebarOpen);
  const toggleRightSidebar = useStore((state) => state.toggleRightSidebar);
  const activeRightSection = useStore((state) => state.activeRightSection);
  const setActiveRightSection = useStore((state) => state.setActiveRightSection);

  const soilAmpVisible = useStore((s) => s.soilAmpVisible);
  const setSoilAmpVisible = useStore((s) => s.setSoilAmpVisible);

  const navItems = [
    { 
      id: 'soilAmp', 
      icon: Waves, 
      label: 'Site Amplification', 
      isToggle: true, 
      isActive: soilAmpVisible, 
      onClick: () => setSoilAmpVisible(!soilAmpVisible) 
    },
    { 
      id: 'analysis', 
      icon: Activity, 
      label: 'State Analysis', 
      isToggle: false, 
      isActive: activeRightSection === 'analysis', 
      onClick: () => setActiveRightSection('analysis') 
    },
  ].filter(item => isAdmin || item.id !== 'analysis');

  const [isHovered, setIsHovered] = useState(false);
  const isExpanded = isRightSidebarOpen || isHovered;

  return (
    <motion.aside
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      initial={false}
      animate={{ width: isExpanded ? 260 : 72 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="absolute top-0 right-0 bottom-0 glass-panel z-50 border-t-0 border-r-0 border-l border-slate-800/80 flex flex-col overflow-visible"
    >
      <div className="p-3 flex items-center justify-end border-b border-slate-800/80 bg-slate-900/50">
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="mr-2 font-bold text-slate-200 tracking-wider whitespace-nowrap overflow-hidden"
            >
              <span className="text-white">TOOLS</span>
            </motion.div>
          )}
        </AnimatePresence>
        <button 
          onClick={toggleRightSidebar}
          className="w-12 h-12 flex items-center justify-center hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-colors shrink-0"
          title="Toggle Right Sidebar"
        >
          <Menu size={20} strokeWidth={2} />
        </button>
      </div>

      <div className="p-3 flex-1 overflow-y-auto space-y-1 overflow-x-hidden">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.id} className="relative group/navitem">
              <button
                onClick={item.onClick}
                className={`w-full flex items-center h-12 rounded-lg transition-all duration-300 relative ${
                  item.isActive 
                    ? 'bg-slate-700/50 text-white' 
                    : 'hover:bg-slate-800/50 text-slate-400 hover:text-slate-200'
                }`}
                style={{ flexDirection: isExpanded ? 'row-reverse' : 'row' }}
              >
                {item.isActive && (
                  <div className="absolute right-0 top-2 bottom-2 w-[3px] rounded-l bg-white" />
                )}
                
                <div className="shrink-0 flex items-center justify-center w-12 h-12">
                  <Icon className={`w-5 h-5 ${item.isActive ? 'text-white' : ''}`} strokeWidth={2} />
                </div>
                
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      className="mr-2 font-medium tracking-wide text-right overflow-hidden whitespace-nowrap flex-1 flex items-center"
                    >
                      {item.isToggle && (
                        <div className={`w-8 h-4 rounded-full p-0.5 shrink-0 flex items-center transition-colors ${item.isActive ? 'bg-cyan-500' : 'bg-slate-700'}`}>
                          <div className={`w-3 h-3 rounded-full bg-white shadow-sm transform transition-transform ${item.isActive ? 'translate-x-4' : 'translate-x-0'}`} />
                        </div>
                      )}
                      <span className="flex-1 text-right ml-3">{item.label}</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>

              {/* Tooltip for collapsed state */}
              {!isExpanded && (
                <div className="absolute right-[80px] top-1/2 -translate-y-1/2 px-3 py-1.5 bg-slate-800 text-slate-200 text-xs font-semibold rounded shadow-lg border border-slate-700 opacity-0 group-hover/navitem:opacity-100 pointer-events-none transition-opacity duration-200 z-50 whitespace-nowrap">
                  {item.label}
                  <div className="absolute top-1/2 -right-1 -translate-y-1/2 border-t-4 border-b-4 border-l-4 border-t-transparent border-b-transparent border-l-slate-800"></div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </motion.aside>
  );
}
