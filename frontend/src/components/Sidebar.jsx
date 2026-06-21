import React, { useEffect, useMemo, useRef } from 'react';
import { AlertTriangle, Play, Radio, Archive, Waves, Mountain, Layers3 } from 'lucide-react';
import useStore from '../store/useStore';

const hazardNavItems = {
  earthquake: [
    { id: 'disasters', icon: Play, label: 'Earthquake Simulation' },
    { id: 'alerts', icon: AlertTriangle, label: 'Alerts' },
    { id: 'live_events', icon: Radio, label: 'Live Events' },
    { id: 'historic_events', icon: Archive, label: 'Historic Earthquakes' },
  ],
  tsunami: [
    { id: 'tsunami', icon: Waves, label: 'Tsunami Estimate' },
  ],
  landslide: [
    { id: 'landslide', icon: Mountain, label: 'Landslide' },
  ],
  other: [
    { id: 'other_hazards', icon: Layers3, label: 'More Hazards' },
  ],
};

const defaultSectionByHazard = {
  earthquake: { admin: 'disasters', public: 'live_events' },
  tsunami: { admin: 'tsunami', public: 'tsunami' },
  landslide: { admin: 'landslide', public: 'landslide' },
  other: { admin: 'other_hazards', public: 'other_hazards' },
};

export default function Sidebar({ isAdmin = false }) {
  const activeHazard = useStore((state) => state.activeHazard);
  const activeSection = useStore((state) => state.activeSection);
  const setActiveSection = useStore((state) => state.setActiveSection);
  const forceActiveSection = useStore((state) => state.forceActiveSection);
  const mode = isAdmin ? 'admin' : 'public';
  const previousHazard = useRef(activeHazard);
  const visibleNavItems = useMemo(() => {
    const navItems = hazardNavItems[activeHazard] || hazardNavItems.earthquake;
    return navItems.filter(item => isAdmin || item.id !== 'disasters');
  }, [activeHazard, isAdmin]);

  useEffect(() => {
    const hazardChanged = previousHazard.current !== activeHazard;
    previousHazard.current = activeHazard;

    const visibleIds = visibleNavItems.map((item) => item.id);
    if (!visibleIds.length) return;
    if ((hazardChanged && !activeSection) || (activeSection && !visibleIds.includes(activeSection))) {
      forceActiveSection(defaultSectionByHazard[activeHazard]?.[mode] || visibleIds[0]);
    }
  }, [activeHazard, activeSection, forceActiveSection, mode, visibleNavItems]);

  return (
    <aside className="glass-panel z-50 border-t-0 border-l-0 flex flex-col shrink-0 w-[260px] shadow-xl relative">
      <div className="p-3 overflow-y-auto space-y-1 overflow-x-hidden mt-4">
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <div key={item.id} className="relative group/navitem">
              <button
                onClick={() => setActiveSection(item.id)}
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
