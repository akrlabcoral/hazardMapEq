import { useCallback } from 'react';
import { useEarthquakeState } from '../useEarthquakeState';

const formatCoords = (epicenter) => {
  if (!epicenter) return 'Lat: --.---, Lng: --.---';
  return `Lat: ${epicenter.lat.toFixed(3)}, Lng: ${epicenter.lng.toFixed(3)}`;
};

export function EpicenterControl() {
  const { epicenter, setEpicenter, isPlacing, setIsPlacing } = useEarthquakeState();

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
        <span className="font-semibold text-slate-100">Earthquake Epicenter</span>
        <div className="flex gap-2">
          <span className={`text-xs px-2 py-1 rounded border ${epicenter ? 'bg-red-900/30 text-red-400 border-red-500/30' : 'bg-slate-700 text-slate-300 border-slate-500'}`}>
            {epicenter ? 'ACTIVE' : 'WAITING'}
          </span>
        </div>
      </div>
      <div className="text-sm font-mono text-white mt-1">{formatCoords(epicenter)}</div>

      <div className="flex gap-2 mt-2">
        <div className="flex-1">
          <label className="text-xs text-slate-300 font-medium block mb-1">Latitude</label>
          <input
            type="number" step="0.0001"
            value={epicenter?.lat ?? ''}
            onChange={handleLatChange}
            className="w-full bg-slate-950 border border-slate-600 text-white placeholder:text-slate-500 text-sm rounded px-2 py-1 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
            placeholder="e.g. 22.5726"
          />
        </div>
        <div className="flex-1">
          <label className="text-xs text-slate-300 font-medium block mb-1">Longitude</label>
          <input
            type="number" step="0.0001"
            value={epicenter?.lng ?? ''}
            onChange={handleLngChange}
            className="w-full bg-slate-950 border border-slate-600 text-white placeholder:text-slate-500 text-sm rounded px-2 py-1 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
            placeholder="e.g. 88.3639"
          />
        </div>
      </div>

      <div className="mt-3">
        <button
          onClick={() => setIsPlacing(!isPlacing)}
          className={`w-full flex justify-center items-center gap-2 py-2 rounded text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
            isPlacing
              ? 'bg-cyan-600 text-white border border-cyan-500'
              : 'bg-slate-700 hover:bg-slate-600 text-slate-100 border border-slate-500'
          }`}
        >
          {isPlacing ? 'Cancel Pin Drop' : 'Drop Pin on Map'}
        </button>
        {isPlacing && (
          <div className="text-[10px] text-white mt-2 text-center animate-pulse">
            Click anywhere on the map to place epicenter.
          </div>
        )}
      </div>
    </div>
  );
}
