import React from 'react';
import { Thermometer } from 'lucide-react';
import useStore from '../store/useStore';

export default function PublicMapToolbar() {
  const intensityVisible = useStore((state) => state.intensityVisible);
  const setIntensityVisible = useStore((state) => state.setIntensityVisible);

  return (
    <div className="glass-panel relative z-40 flex h-8 items-center border-x-0 border-t border-slate-800/80 px-6">
      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />
      <button
        type="button"
        onClick={() => setIntensityVisible(!intensityVisible)}
        className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
          intensityVisible
            ? 'border-cyan-500/50 bg-slate-700/60 text-white'
            : 'border-slate-700/50 bg-slate-900/50 text-slate-400 hover:bg-slate-800/70 hover:text-slate-200'
        }`}
        aria-pressed={intensityVisible}
      >
        <Thermometer className="h-4 w-4" strokeWidth={2} />
        <span>MMI Intensity</span>
        <span className={`flex h-4 w-8 items-center rounded-full p-0.5 transition-colors ${intensityVisible ? 'bg-cyan-500' : 'bg-slate-700'}`}>
          <span className={`h-3 w-3 rounded-full bg-white shadow-sm transition-transform ${intensityVisible ? 'translate-x-4' : 'translate-x-0'}`} />
        </span>
      </button>
    </div>
  );
}
