// src/panels/disasters/StateFilter.jsx
// State isolation dropdown — filter simulation view to a single state

import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import useStore from '../../store/useStore';

export function StateFilter() {
  const { selectedStateName, setSelectedStateName, stateIdMapping } = useStore(
    useShallow((s) => ({
      selectedStateName:    s.selectedStateName,
      setSelectedStateName: s.setSelectedStateName,
      stateIdMapping:       s.stateIdMapping,
    }))
  );

  const sortedStateNames = useMemo(
    () => Object.keys(stateIdMapping || {}).sort(),
    [stateIdMapping]
  );

  return (
    <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
      <div className="text-xs text-slate-200 font-semibold uppercase tracking-wider mb-2">State Isolation</div>
      <select
        value={selectedStateName || ''}
        onChange={(e) => setSelectedStateName(e.target.value || null)}
        className="w-full bg-slate-950 border border-slate-600 text-white text-sm rounded px-2 py-1.5 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
      >
        <option value="">All States (Nationwide)</option>
        {sortedStateNames.map((name) => (
          <option key={name} value={name}>{name}</option>
        ))}
      </select>
    </div>
  );
}
