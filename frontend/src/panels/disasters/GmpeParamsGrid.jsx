// src/panels/disasters/GmpeParamsGrid.jsx
// Advanced GMPE parameter inputs grid

import { useEarthquakeState } from '../../hooks/useEarthquakeState';

const PARAMS = [
  { key: 'c1', label: 'c₁ (Offset)' },
  { key: 'c2', label: 'c₂ (Linear M)' },
  { key: 'c3', label: 'c₃ (Quad M)' },
  { key: 'c4', label: 'c₄ (Anelastic)' },
  { key: 'C',  label: 'C (Geometric)' },
];

export function GmpeParamsGrid() {
  const { gmpeParams, updateGmpeParam, useCustomGmpe, setUseCustomGmpe } = useEarthquakeState();

  return (
    <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs text-slate-400 uppercase tracking-wider">Custom GMPE Overrides</div>
        <label className="flex items-center cursor-pointer">
          <div className="relative">
            <input 
              type="checkbox" 
              className="sr-only" 
              checked={useCustomGmpe}
              onChange={() => setUseCustomGmpe(!useCustomGmpe)} 
            />
            <div className={`block w-8 h-4 rounded-full transition-colors ${useCustomGmpe ? 'bg-cyan-500' : 'bg-slate-600'}`}></div>
            <div className={`absolute left-0.5 top-0.5 bg-white w-3 h-3 rounded-full transition-transform ${useCustomGmpe ? 'transform translate-x-4' : ''}`}></div>
          </div>
        </label>
      </div>
      
      {!useCustomGmpe && (
        <div className="text-[10px] text-slate-400 mb-2 italic">
          GMPE will be auto-selected based on the tectonic region (Himalaya, Northeast, or Peninsular). Enable this toggle to manually override.
        </div>
      )}

      <div className={`grid grid-cols-2 gap-2 transition-opacity ${useCustomGmpe ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
        {PARAMS.map(({ key, label }) => (
          <div key={key} className="flex flex-col">
            <label className="text-[10px] text-slate-500 mb-0.5">{label}</label>
            <input
              type="number" step="0.001"
              value={gmpeParams[key]}
              onChange={(e) => { const v = parseFloat(e.target.value); updateGmpeParam(key, isNaN(v) ? 0 : v); }}
              disabled={!useCustomGmpe}
              className="w-full bg-slate-900 border border-slate-700 text-slate-300 font-mono text-xs rounded px-2 py-1 focus:outline-none focus:border-cyan-500 disabled:opacity-50"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
