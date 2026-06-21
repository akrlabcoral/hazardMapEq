import React, { useMemo, useState } from 'react';
import { Calculator, Gauge, MapPin, Mountain, Play, RotateCcw, Ruler, Waves } from 'lucide-react';
import { useSimulation } from '../../hazards/earthquake/useSimulation';
import { calculateTsunamiHazard, buildTsunamiInfoPanel } from '../../hazards/tsunami';
import useStore from '../../store/useStore';
import HazardBottomPanel from './HazardBottomPanel';

const TSUNAMI_DEFAULT_FORM = {
  magnitude: '7.0',
  depth_m: '4000',
  period_s: '1200',
  seabed_displacement_m: '',
  wave_height_m: '',
  distance_km: '',
  amplification_factor: '3',
};

const toOptionalNumber = (value) => {
  if (value === '' || value === null || value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

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

const tsunamiResultRows = (result) => {
  if (!result) return [['Potential', 'Not calculated']];
  return [
    ['Potential', `${result.tsunami_potential_class.level}`],
    ['Speed', `${result.tsunami_speed_kmh.toFixed(1)} km/h`],
    ['Wavelength', `${(result.wavelength_m / 1000).toFixed(1)} km`],
    ['Run-up', result.estimated_runup_m == null ? 'Not provided' : `${result.estimated_runup_m.toFixed(2)} m`],
  ];
};

const useEarthquakeLayout = () => {
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

const useTsunamiLayout = () => {
  const earthquakeEpicenter = useStore((state) => state.earthquakeEpicenter);
  const earthquakeMagnitude = useStore((state) => state.earthquakeMagnitude);
  const setTsunamiResult = useStore((state) => state.setTsunamiResult);
  const setTsunamiSource = useStore((state) => state.setTsunamiSource);
  const clearTsunamiState = useStore((state) => state.clearTsunamiState);
  const setInfoPanel = useStore((state) => state.setInfoPanel);
  const tsunamiResult = useStore((state) => state.tsunamiResult);
  const tsunamiSource = useStore((state) => state.tsunamiSource);
  const [form, setForm] = useState(TSUNAMI_DEFAULT_FORM);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const useCurrentEarthquake = () => {
    if (!earthquakeEpicenter) return;
    setTsunamiSource(earthquakeEpicenter);
    setForm((current) => ({
      ...current,
      magnitude: String(earthquakeMagnitude ?? current.magnitude),
      depth_m: current.depth_m || '4000',
      period_s: current.period_s || '1200',
      amplification_factor: current.amplification_factor || '3',
    }));
  };

  const calculate = async () => {
    setIsLoading(true);
    setError('');
    try {
      const result = await calculateTsunamiHazard({
        magnitude: Number(form.magnitude),
        depth_m: Number(form.depth_m || 4000),
        period_s: Number(form.period_s || 1200),
        seabed_displacement_m: toOptionalNumber(form.seabed_displacement_m),
        wave_height_m: toOptionalNumber(form.wave_height_m),
        distance_km: toOptionalNumber(form.distance_km),
        amplification_factor: Number(form.amplification_factor || 3),
        latitude: tsunamiSource?.lat,
        longitude: tsunamiSource?.lng,
      });
      setTsunamiResult(result);
      setInfoPanel(buildTsunamiInfoPanel(result, tsunamiSource));
    } catch (err) {
      setError(err.message || 'Tsunami calculation failed');
    } finally {
      setIsLoading(false);
    }
  };

  const clear = () => {
    setForm(TSUNAMI_DEFAULT_FORM);
    setError('');
    clearTsunamiState();
  };

  const sourceLabel = tsunamiSource
    ? `${tsunamiSource.lat.toFixed(4)}, ${tsunamiSource.lng.toFixed(4)}`
    : 'No mapped source';

  return {
    id: 'tsunami',
    title: 'Tsunami Estimate',
    status: tsunamiResult ? `${tsunamiResult.tsunami_potential_class.level} potential` : 'Empirical model',
    sections: [
      {
        id: 'source',
        title: 'Source Params',
        icon: MapPin,
        content: (
          <div className="space-y-2">
            <NumberInput label="Magnitude" value={form.magnitude} onChange={(value) => updateField('magnitude', value)} />
            <div className="rounded-lg bg-slate-950/50 px-2 py-1.5 font-mono text-xs text-slate-100">{sourceLabel}</div>
          </div>
        ),
      },
      {
        id: 'ocean',
        title: 'Ocean Params',
        icon: Waves,
        content: (
          <div className="grid grid-cols-2 gap-2">
            <NumberInput label="Depth (m)" value={form.depth_m} onChange={(value) => updateField('depth_m', value)} />
            <NumberInput label="Period (s)" value={form.period_s} onChange={(value) => updateField('period_s', value)} />
            <NumberInput label="Distance (km)" value={form.distance_km} onChange={(value) => updateField('distance_km', value)} />
            <NumberInput label="Amplification" value={form.amplification_factor} onChange={(value) => updateField('amplification_factor', value)} />
          </div>
        ),
      },
      {
        id: 'wave',
        title: 'Wave Params',
        icon: Gauge,
        content: (
          <div className="grid grid-cols-2 gap-2">
            <NumberInput label="Seabed shift (m)" value={form.seabed_displacement_m} onChange={(value) => updateField('seabed_displacement_m', value)} />
            <NumberInput label="Wave height (m)" value={form.wave_height_m} onChange={(value) => updateField('wave_height_m', value)} />
            <div className="col-span-2 rounded-lg border border-cyan-500/30 bg-cyan-950/30 px-2 py-1.5 text-[10px] leading-snug text-cyan-100">
              Simplified empirical estimate, not an official warning product.
            </div>
          </div>
        ),
      },
      {
        id: 'results',
        title: 'Results',
        icon: Calculator,
        accent: 'amber',
        content: (
          <div className="space-y-1.5">
            {tsunamiResultRows(tsunamiResult).map(([label, value]) => (
              <div key={label} className="grid grid-cols-[86px_1fr] gap-2 text-xs">
                <span className="text-slate-400">{label}</span>
                <span className="truncate text-right font-mono text-slate-100">{value}</span>
              </div>
            ))}
            {error && <div className="rounded border border-red-400/40 bg-red-950/40 px-2 py-1 text-xs text-red-200">{error}</div>}
          </div>
        ),
      },
    ],
    actions: [
      {
        id: 'use-earthquake',
        label: earthquakeEpicenter ? 'Use Earthquake' : 'Place Epicenter',
        icon: MapPin,
        disabled: !earthquakeEpicenter,
        onClick: useCurrentEarthquake,
      },
      { id: 'clear', label: 'Clear', icon: RotateCcw, onClick: clear },
      {
        id: 'calculate',
        label: isLoading ? 'Calculating...' : 'Calculate',
        icon: Calculator,
        variant: 'primary',
        disabled: isLoading,
        onClick: calculate,
      },
    ],
  };
};

const placeholderLayout = (id, title, icon) => ({
  id,
  title,
  status: 'Placeholder',
  sections: [
    {
      id: `${id}-module`,
      title,
      icon,
      accent: 'amber',
      content: <div className="text-sm text-slate-300">Module placeholder</div>,
    },
  ],
  actions: [],
});

const landslideLayout = {
  id: 'landslide',
  title: 'Landslide Assessment',
  status: 'Placeholder',
  sections: [
    {
      id: 'landslide-trigger',
      title: 'Trigger',
      icon: Mountain,
      accent: 'amber',
      content: (
        <div className="space-y-2 text-xs text-slate-300">
          <div className="rounded-lg bg-slate-950/50 px-2 py-1.5">Rainfall / shaking input pending</div>
          <div className="rounded-lg bg-slate-950/50 px-2 py-1.5">Trigger threshold pending</div>
        </div>
      ),
    },
    {
      id: 'landslide-terrain',
      title: 'Terrain',
      icon: Ruler,
      content: (
        <div className="space-y-2 text-xs text-slate-300">
          <div className="rounded-lg bg-slate-950/50 px-2 py-1.5">Slope layer pending</div>
          <div className="rounded-lg bg-slate-950/50 px-2 py-1.5">Aspect / elevation pending</div>
        </div>
      ),
    },
    {
      id: 'landslide-soil',
      title: 'Soil',
      icon: Gauge,
      content: (
        <div className="space-y-2 text-xs text-slate-300">
          <div className="rounded-lg bg-slate-950/50 px-2 py-1.5">Soil class pending</div>
          <div className="rounded-lg bg-slate-950/50 px-2 py-1.5">Moisture factor pending</div>
        </div>
      ),
    },
    {
      id: 'landslide-results',
      title: 'Results',
      icon: Calculator,
      accent: 'amber',
      content: (
        <div className="space-y-2 text-xs text-slate-300">
          <div className="rounded-lg bg-slate-950/50 px-2 py-1.5">Susceptibility not calculated</div>
          <div className="rounded-lg bg-slate-950/50 px-2 py-1.5">Exposure summary pending</div>
        </div>
      ),
    },
  ],
  actions: [
    { id: 'landslide-clear', label: 'Clear', icon: RotateCcw, disabled: true },
    { id: 'landslide-run', label: 'Run Model', icon: Play, variant: 'primary', disabled: true },
  ],
};

export default function HazardWorkflowDock({ onClose }) {
  const activeHazard = useStore((state) => state.activeHazard);
  const earthquakeLayout = useEarthquakeLayout();
  const tsunamiLayout = useTsunamiLayout();

  const layout = useMemo(() => {
    if (activeHazard === 'tsunami') return tsunamiLayout;
    if (activeHazard === 'landslide') return landslideLayout;
    if (activeHazard === 'other') return placeholderLayout('other-hazards', 'More Hazards', Waves);
    return earthquakeLayout;
  }, [activeHazard, earthquakeLayout, tsunamiLayout]);

  return <HazardBottomPanel layout={layout} onClose={onClose} />;
}
