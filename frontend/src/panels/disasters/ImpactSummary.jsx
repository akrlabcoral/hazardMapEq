// src/panels/disasters/ImpactSummary.jsx
// District impact results + CSV/JSON export buttons

import { useShallow } from 'zustand/react/shallow';
import useStore from '../../store/useStore';

export function ImpactSummary() {
  const { simulationResults } = useStore(
    useShallow((s) => ({ simulationResults: s.simulationResults }))
  );

  if (!simulationResults?.district_summary) return null;

  const topDistricts = [...simulationResults.district_summary]
    .sort((a, b) => b.max_pga - a.max_pga)
    .slice(0, 5);

  const remaining = simulationResults.district_summary.length - 5;

  return (
    <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
      <div className="text-xs text-slate-400 uppercase tracking-wider mb-2 flex justify-between">
        <span>Scientific Impact Summary</span>
        <span className="text-cyan-400 font-mono">ID: {simulationResults.simulation_id}</span>
      </div>

      <div className="max-h-40 overflow-y-auto pr-2 space-y-2 mb-3">
        {topDistricts.map((d) => (
          <div key={d.district} className="flex justify-between items-center text-xs">
            <span className="text-slate-300 font-medium truncate w-1/3">{d.district}</span>
            <span className="text-red-400 font-mono w-1/4 text-right">{d.max_pga.toFixed(2)}g</span>
            <span className="text-orange-400 font-mono w-1/4 text-right text-[10px]">{d.severe_cells} svr</span>
          </div>
        ))}
        {remaining > 0 && (
          <div className="text-[10px] text-slate-500 text-center italic">+ {remaining} more districts</div>
        )}
      </div>

      <div className="flex gap-2 border-t border-slate-700/50 pt-3">
        <a
          href={`/scientific-api/export/${simulationResults.simulation_id}?format=csv`}
          target="_blank" rel="noreferrer"
          className="flex-1 text-center py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-[10px] font-bold uppercase tracking-wider text-slate-200 transition-colors"
        >
          Export CSV
        </a>
        <a
          href={`/scientific-api/export/${simulationResults.simulation_id}?format=json`}
          target="_blank" rel="noreferrer"
          className="flex-1 text-center py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-[10px] font-bold uppercase tracking-wider text-slate-200 transition-colors"
        >
          Export JSON
        </a>
      </div>
    </div>
  );
}
