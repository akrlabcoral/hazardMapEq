import React, { useEffect, useMemo, useRef } from 'react';
import { getDefaultSection, getVisibleHazardPanels } from '../hazards/registry';
import useStore from '../store/useStore';

export default function Sidebar({ isAdmin = false }) {
  const activeHazard = useStore((state) => state.activeHazard);
  const activePanel = useStore((state) => state.activePanel);
  const setActivePanel = useStore((state) => state.setActivePanel);
  const forceActivePanel = useStore((state) => state.forceActivePanel);
  const mode = isAdmin ? 'admin' : 'public';
  const previousHazard = useRef(activeHazard);
  const visibleNavItems = useMemo(() => {
    return getVisibleHazardPanels(activeHazard, mode);
  }, [activeHazard, mode]);

  useEffect(() => {
    const hazardChanged = previousHazard.current !== activeHazard;
    previousHazard.current = activeHazard;

    const visibleIds = visibleNavItems.map((item) => item.id);
    if (!visibleIds.length) return;
    if ((hazardChanged && !activePanel) || (activePanel && !visibleIds.includes(activePanel))) {
      forceActivePanel(getDefaultSection(activeHazard, mode) || visibleIds[0]);
    }
  }, [activeHazard, activePanel, forceActivePanel, mode, visibleNavItems]);

  return (
    <aside className="glass-panel z-50 border-t-0 border-l-0 flex flex-col shrink-0 w-[260px] shadow-xl relative">
      <div className="p-3 overflow-y-auto space-y-1 overflow-x-hidden mt-4">
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePanel === item.id;
          return (
            <div key={item.id} className="relative group/navitem">
              <button
                onClick={() => setActivePanel(item.id)}
                className={`w-full flex items-center h-12 transition-all duration-300 relative ${
                  isActive 
                    ? 'bg-slate-700/50 text-white' 
                    : 'hover:bg-slate-800/50 text-slate-400 hover:text-slate-200'
                }`}
              >
                {isActive && (
                  <div className="absolute left-0 top-2 bottom-2 w-[3px] bg-white" />
                )}
                
                <div className="shrink-0 flex items-center justify-center w-12 h-12">
                  <Icon className={`w-5 h-5 ${isActive ? 'text-white' : ''}`} strokeWidth={2} />
                </div>
                
                <div className="ml-2 font-medium tracking-wide text-left overflow-hidden whitespace-nowrap">
                  {item.label}
                </div>
              </button>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
