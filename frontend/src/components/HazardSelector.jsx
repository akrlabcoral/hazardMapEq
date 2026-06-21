import React from 'react';
import { Activity, Layers3, Mountain, Waves } from 'lucide-react';
import useStore from '../store/useStore';

const HAZARDS = [
  {
    id: 'earthquake',
    label: 'Earthquake',
    icon: Activity,
    defaultSection: { admin: 'disasters', public: 'live_events' },
  },
  {
    id: 'tsunami',
    label: 'Tsunami',
    icon: Waves,
    defaultSection: { admin: 'tsunami', public: 'tsunami' },
  },
  {
    id: 'landslide',
    label: 'Landslide',
    icon: Mountain,
    defaultSection: { admin: 'landslide', public: 'landslide' },
  },
  {
    id: 'other',
    label: 'More',
    icon: Layers3,
    defaultSection: { admin: 'other_hazards', public: 'other_hazards' },
  },
];

const VALID_SECTIONS_BY_HAZARD = {
  earthquake: ['disasters', 'alerts', 'live_events', 'historic_events'],
  tsunami: ['tsunami'],
  landslide: ['landslide'],
  other: ['other_hazards'],
};

export default function HazardSelector({ isAdmin = false }) {
  const activeHazard = useStore((state) => state.activeHazard);
  const activeSection = useStore((state) => state.activeSection);
  const setActiveHazard = useStore((state) => state.setActiveHazard);
  const forceActiveSection = useStore((state) => state.forceActiveSection);
  const mode = isAdmin ? 'admin' : 'public';

  const selectHazard = (hazard) => {
    setActiveHazard(hazard.id);

    const validSections = VALID_SECTIONS_BY_HAZARD[hazard.id] || [];
    const publicSafeSection = !isAdmin && activeSection === 'disasters' ? null : activeSection;
    if (!publicSafeSection || !validSections.includes(publicSafeSection)) {
      forceActiveSection(hazard.defaultSection[mode]);
    }
  };

  return (
    <div className="flex items-center rounded-xl border border-slate-600/50 bg-slate-900/35 p-1 shadow-inner">
      {HAZARDS.map((hazard) => {
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
