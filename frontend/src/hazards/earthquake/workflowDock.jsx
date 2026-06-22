import React from 'react';
import { Gauge, MapPin, Play, RotateCcw, Ruler } from 'lucide-react';

import useStore from '../../store/useStore';
import HazardBottomPanel from '../../components/hazards/HazardBottomPanel';
import { useSimulation } from './useSimulation';

const NumberInput = ({ label, value, onChange, min = '0', step = '0.1' }) => (
  <label className="block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
    {label}
    <input
      type="number"
      min={min}
      step={step}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="mt-1 h-9 w-full rounded-lg border border-slate-600 bg-slate-950/80 px-2 text-sm font-bold text-white focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
    />
  </label>
);

const formatCoords = (epicenter) => {
  if (!epicenter) return 'Lat: --.---, Lng: --.---';
  return `Lat: ${epicenter.lat.toFixed(3)}, Lng: ${epicenter.lng.toFixed(3)}`;
};

export const useEarthquakeWorkflowDockLayout = () => {
  const earthquakeEpicenter = useStore((state) => state.earthquakeEpicenter);
  const setEarthquakeEpicenter = useStore((state) => state.setEarthquakeEpicenter);
  const earthquakeMagnitude = useStore((state) => state.earthquakeMagnitude);
  const setEarthquakeMagnitude = useStore((state) => state.setEarthquakeMagnitude);
  const earthquakeDepth = useStore((state) => state.earthquakeDepth);
  const setEarthquakeDepth = useStore((state) => state.setEarthquakeDepth);
  const isPlacingEpicenter = useStore((state) => state.isPlacingEpicenter);
  const setIsPlacingEpicenter = useStore((state) => state.setIsPlacingEpicenter);
  const isSimulationRunning = useStore((state) => state.isSimulationRunning);
  const clearSimulationState = useStore((state) => state.clearSimulationState);
  const { handleRunSimulation } = useSimulation();

  const updateEpicenter = (field, value) => {
    const parsed = parseFloat(value);
    setEarthquakeEpicenter({
      lat: field === 'lat' ? (Number.isNaN(parsed) ? 0 : parsed) : earthquakeEpicenter?.lat ?? 22.5726,
      lng: field === 'lng' ? (Number.isNaN(parsed) ? 0 : parsed) : earthquakeEpicenter?.lng ?? 88.3639,
    });
  };

  return {
    id: 'earthquake',
    title: 'Earthquake Simulation',
    status: earthquakeEpicenter ? 'Epicenter set' : 'Waiting',
    sections: [
      {
        id: 'epicenter',
        title: 'Epicenter',
        icon: MapPin,
        accent: 'red',
        content: (
          <div className="space-y-2">
            <div className="rounded-lg bg-slate-950/50 px-2 py-1.5 font-mono text-xs text-slate-100">{formatCoords(earthquakeEpicenter)}</div>
            <div className="grid grid-cols-2 gap-2">
              <NumberInput label="Latitude" value={earthquakeEpicenter?.lat ?? ''} onChange={(value) => updateEpicenter('lat', value)} step="0.0001" />
              <NumberInput label="Longitude" value={earthquakeEpicenter?.lng ?? ''} onChange={(value) => updateEpicenter('lng', value)} step="0.0001" />
            </div>
          </div>
        ),
      },
      {
        id: 'magnitude',
        title: 'Magnitude',
        icon: Gauge,
        accent: 'red',
        content: (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Moment magnitude</span>
              <span className="text-xl font-black text-red-300">M {earthquakeMagnitude.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="9.5"
              step="0.1"
              value={earthquakeMagnitude}
              onChange={(event) => setEarthquakeMagnitude(parseFloat(event.target.value) || 0)}
              className="w-full accent-red-500"
            />
            <div className="flex justify-between text-[10px] text-slate-500"><span>0.0</span><span>9.5</span></div>
          </div>
        ),
      },
      {
        id: 'depth',
        title: 'Depth',
        icon: Ruler,
        content: (
          <NumberInput
            label="Depth (km)"
            min="1"
            value={earthquakeDepth}
            onChange={(value) => setEarthquakeDepth(parseFloat(value) || 1)}
          />
        ),
      },
    ],
    actions: [
      { id: 'clear', label: 'Clear Map', icon: RotateCcw, onClick: clearSimulationState },
      {
        id: 'place',
        label: isPlacingEpicenter ? 'Cancel Pin' : 'Drop Pin',
        icon: MapPin,
        variant: 'primary',
        onClick: () => setIsPlacingEpicenter(!isPlacingEpicenter),
      },
      {
        id: 'run',
        label: isSimulationRunning ? 'Running...' : 'Run Sim',
        icon: Play,
        variant: 'danger',
        disabled: !earthquakeEpicenter || isSimulationRunning,
        onClick: handleRunSimulation,
      },
    ],
  };
};

export default function EarthquakeWorkflowDock({ onClose }) {
  return <HazardBottomPanel layout={useEarthquakeWorkflowDockLayout()} onClose={onClose} />;
}
