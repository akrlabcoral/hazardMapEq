// src/panels/disasters/HazardModules.jsx
// Hazard Intelligence Modules — layer toggles + weight sliders

import { useLayersState } from '../../hooks/useLayersState';
import { HAZARD_LAYERS } from '../../services/layerCapabilities';

export function HazardModules() {
  const { hazardLayers, toggleHazardLayer, setHazardLayerWeight } = useLayersState();

  return (
    <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
      <div className="text-xs text-slate-400 uppercase tracking-wider mb-3">Hazard Intelligence Modules</div>
      <div className="space-y-3">
        {HAZARD_LAYERS.map((layer) => {
          const config = hazardLayers[layer.id];
          return (
            <div key={layer.id} className={`p-2 rounded border ${layer.placeholder ? 'opacity-50 grayscale border-slate-700' : 'border-slate-600 bg-slate-900/50'}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-300 font-medium flex items-center">
                  {layer.label}
                  {layer.placeholder && (
                    <span className="ml-2 text-[9px] px-1 rounded border border-slate-600 text-slate-400 uppercase">Placeholder</span>
                  )}
                </span>
                <label className={`cursor-pointer ${layer.placeholder ? 'pointer-events-none' : ''}`}>
                  <div className={`w-8 h-4 rounded-full p-0.5 flex transition-colors duration-300 ${config?.active ? 'bg-cyan-500' : 'bg-slate-700'}`}>
                    <div className={`w-3 h-3 rounded-full bg-white shadow-sm transform transition-transform duration-300 ${config?.active ? 'translate-x-4' : 'translate-x-0'}`} />
                  </div>
                  <input
                    type="checkbox"
                    checked={config?.active || false}
                    onChange={() => toggleHazardLayer(layer.id)}
                    className="hidden"
                    disabled={layer.placeholder}
                  />
                </label>
              </div>
              {config?.active && !layer.placeholder && (
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-700/50">
                  <span className="text-[10px] text-slate-500 uppercase">Weight:</span>
                  <input
                    type="range" min="0" max="1" step="0.1"
                    value={config.weight}
                    onChange={(e) => setHazardLayerWeight(layer.id, parseFloat(e.target.value))}
                    className="flex-1 accent-cyan-500 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-[10px] text-cyan-400 w-6 text-right font-mono">{config.weight.toFixed(1)}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
