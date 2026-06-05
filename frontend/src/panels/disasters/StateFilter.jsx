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
      <div className="text-xs text-slate-400 uppercase tracking-wider mb-2">State Isolation</div>
      <select
        value={selectedStateName || ''}
        onChange={(e) => setSelectedStateName(e.target.value || null)}
        className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded px-2 py-1.5 focus:outline-none focus:border-cyan-500"
      >
        <option value="">All States (Nationwide)</option>
        {sortedStateNames.map((name) => (
          <option key={name} value={name}>{name}</option>
        ))}
      </select>
    </div>
  );
}
