// src/panels/disasters/MagnitudeDepthRow.jsx
// Magnitude and Depth inputs side-by-side

import { useEarthquakeState } from '../../hooks/useEarthquakeState';

export function MagnitudeDepthRow() {
  const { magnitude, setMagnitude, depth, setDepth } = useEarthquakeState();

  return (
    <div className="flex gap-3">
      {/* Magnitude */}
      <div className="flex-1 p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
        <div className="flex justify-between items-center mb-2">
          <span className="font-semibold text-slate-300 text-sm">Magnitude</span>
          <span className="text-base font-bold neon-text-alert">{magnitude.toFixed(1)}</span>
        </div>
        <input
          type="number" min="1.0" max="10.0" step="0.1"
          value={magnitude}
          onChange={(e) => { const v = parseFloat(e.target.value); setMagnitude(isNaN(v) ? 1.0 : v); }}
          className="w-full bg-slate-900 border border-slate-700 text-red-400 font-bold text-base rounded px-2 py-1.5 focus:outline-none focus:border-red-500"
        />
      </div>

      {/* Depth */}
      <div className="flex-1 p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
        <div className="flex justify-between items-center mb-2">
          <span className="font-semibold text-slate-300 text-sm">Depth</span>
          <span className="text-base font-bold text-cyan-400">{depth} km</span>
        </div>
        <input
          type="number" min="1" max="10000" step="0.1"
          value={depth}
          onChange={(e) => { const v = parseFloat(e.target.value); setDepth(isNaN(v) ? 1 : v); }}
          className="w-full bg-slate-900 border border-slate-700 text-cyan-400 font-bold text-base rounded px-2 py-1.5 focus:outline-none focus:border-cyan-500"
        />
      </div>
    </div>
  );
}
