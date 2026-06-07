// src/panels/DisastersPanel.jsx
// Full Disasters panel — composed from extracted sub-components

import { RefreshCw, Play } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import useStore from '../store/useStore';
import { useSimulation } from '../hooks/useSimulation';
import { EpicenterControl } from './disasters/EpicenterControl';
import { MagnitudeDepthRow } from './disasters/MagnitudeDepthRow';
import { GmpeParamsGrid } from './disasters/GmpeParamsGrid';
import { HazardModules } from './disasters/HazardModules';
import { StateFilter } from './disasters/StateFilter';

export function DisastersPanel() {
  const { earthquakeEpicenter, isSimulationRunning, clearSimulationState } = useStore(
    useShallow((s) => ({
      earthquakeEpicenter:  s.earthquakeEpicenter,
      isSimulationRunning:  s.isSimulationRunning,
      clearSimulationState: s.clearSimulationState,
    }))
  );

  const { handleRunSimulation } = useSimulation();

  return (
    <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={clearSimulationState}
          className="flex-1 flex justify-center items-center gap-2 px-5 py-3 rounded-lg font-bold text-sm uppercase tracking-wider transition-all duration-300 bg-slate-700 hover:bg-slate-600 text-slate-100 border border-slate-500 hover:border-slate-400"
        >
          <RefreshCw size={16} />
          Clear Map
        </button>
        <button
          onClick={handleRunSimulation}
          disabled={!earthquakeEpicenter || isSimulationRunning}
          className={`flex-1 flex justify-center items-center gap-2 px-5 py-3 rounded-lg font-bold text-sm uppercase tracking-wider transition-all duration-300 ${
            !earthquakeEpicenter || isSimulationRunning
              ? 'bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed opacity-80'
              : 'bg-red-600 hover:bg-red-500 text-white border border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)] hover:shadow-[0_0_25px_rgba(239,68,68,0.5)]'
          }`}
        >
          <Play size={16} />
          {isSimulationRunning ? 'Running...' : 'Run Sim'}
        </button>
      </div>

      <EpicenterControl />
      <MagnitudeDepthRow />
      <GmpeParamsGrid />
      <StateFilter />
      <HazardModules />
    </div>
  );
}
