import React from 'react';
import { getDefaultSection, getHazards, getHazardPanelIds } from '../hazards/registry';
import useStore from '../store/useStore';

export default function HazardSelector({ isAdmin = false }) {
  const activeHazard = useStore((state) => state.activeHazard);
  const activePanel = useStore((state) => state.activePanel);
  const setActiveHazard = useStore((state) => state.setActiveHazard);
  const forceActivePanel = useStore((state) => state.forceActivePanel);
  const mode = isAdmin ? 'admin' : 'public';

  const selectHazard = (hazard) => {
    setActiveHazard(hazard.id);

    const validSections = getHazardPanelIds(hazard.id, mode);
    if (!activePanel || !validSections.includes(activePanel)) {
      forceActivePanel(getDefaultSection(hazard.id, mode));
    }
  };

  return (
    <div className="flex items-center rounded-xl border border-slate-600/50 bg-slate-900/35 p-1 shadow-inner">
      {getHazards().map((hazard) => {
        const Icon = hazard.icon;
        const isActive = activeHazard === hazard.id;
        return (
          <button
            key={hazard.id}
            type="button"
            onClick={() => selectHazard(hazard)}
            className={`flex h-8 items-center gap-2 rounded-lg px-3 text-xs font-bold uppercase tracking-[0.14em] transition-colors ${
              isActive
                ? 'bg-cyan-400/20 text-cyan-100 shadow-[0_0_16px_rgba(34,211,238,0.18)]'
                : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-100'
            }`}
            aria-pressed={isActive}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden lg:inline">{hazard.label}</span>
          </button>
        );
      })}
    </div>
  );
}
