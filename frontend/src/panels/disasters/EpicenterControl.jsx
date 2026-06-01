// src/panels/disasters/EpicenterControl.jsx
// Epicenter section: lat/lng display, manual inputs, and Drop Pin button

import { useCallback, useEffect } from 'react';
import { useEarthquakeState } from '../../hooks/useEarthquakeState';

const formatCoords = (epicenter) => {
  if (!epicenter) return 'Lat: --.---, Lng: --.---';
  return `Lat: ${epicenter.lat.toFixed(3)}, Lng: ${epicenter.lng.toFixed(3)}`;
};

export function EpicenterControl() {
  const { epicenter, setEpicenter, isPlacing, setIsPlacing, epicenterRegion, setEpicenterRegion } = useEarthquakeState();

  useEffect(() => {
    if (!epicenter) {
      setEpicenterRegion(null);
      return;
    }
    
    // Fetch region from backend
    fetch(`/scientific-api/region?lat=${epicenter.lat}&lon=${epicenter.lng}`)
      .then(res => res.json())
      .then(data => setEpicenterRegion(data.region))
      .catch(err => console.error("Failed to fetch region:", err));
      
  }, [epicenter, setEpicenterRegion]);

  const handleLatChange = useCallback((e) => {
    const val = parseFloat(e.target.value);
    setEpicenter({ lat: isNaN(val) ? 0 : val, lng: epicenter?.lng ?? 88.3639 });
  }, [epicenter, setEpicenter]);

  const handleLngChange = useCallback((e) => {
    const val = parseFloat(e.target.value);
    setEpicenter({ lat: epicenter?.lat ?? 22.5726, lng: isNaN(val) ? 0 : val });
  }, [epicenter, setEpicenter]);

  return (
    <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
      <div className="flex justify-between items-center">
        <span className="font-semibold text-slate-300">Earthquake Epicenter</span>
        <div className="flex gap-2">
          {epicenterRegion && (
            <span className="text-[10px] px-2 py-1 rounded bg-cyan-900/40 text-cyan-400 border border-cyan-700/50">
              {epicenterRegion}
            </span>
          )}
          <span className={`text-xs px-2 py-1 rounded border ${epicenter ? 'bg-red-900/30 text-red-400 border-red-500/30' : 'bg-slate-900 text-slate-500 border-slate-700'}`}>
            {epicenter ? 'ACTIVE' : 'WAITING'}
          </span>
        </div>
      </div>
      <div className="text-sm font-mono text-cyan-400 mt-1">{formatCoords(epicenter)}</div>

      <div className="flex gap-2 mt-2">
        <div className="flex-1">
          <label className="text-xs text-slate-500 block mb-1">Latitude</label>
          <input
            type="number" step="0.0001"
            value={epicenter?.lat ?? ''}
            onChange={handleLatChange}
            className="w-full bg-slate-900 border border-slate-700 text-cyan-400 text-sm rounded px-2 py-1 focus:outline-none focus:border-cyan-500"
            placeholder="e.g. 22.5726"
          />
        </div>
        <div className="flex-1">
          <label className="text-xs text-slate-500 block mb-1">Longitude</label>
          <input
            type="number" step="0.0001"
            value={epicenter?.lng ?? ''}
            onChange={handleLngChange}
            className="w-full bg-slate-900 border border-slate-700 text-cyan-400 text-sm rounded px-2 py-1 focus:outline-none focus:border-cyan-500"
            placeholder="e.g. 88.3639"
          />
        </div>
      </div>

      <div className="mt-3">
        <button
          onClick={() => setIsPlacing(!isPlacing)}
          className={`w-full flex justify-center items-center gap-2 py-2 rounded text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
            isPlacing
              ? 'bg-cyan-900/40 text-cyan-400 border border-cyan-500/50 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
              : 'bg-slate-700/50 hover:bg-slate-600 text-slate-300 border border-slate-600'
          }`}
        >
          {isPlacing ? 'Cancel Pin Drop' : 'Drop Pin on Map'}
        </button>
        {isPlacing && (
          <div className="text-[10px] text-cyan-400 mt-2 text-center animate-pulse">
            Click anywhere on the map to place epicenter.
          </div>
        )}
      </div>
    </div>
  );
}
