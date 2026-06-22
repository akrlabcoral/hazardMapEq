import React, { useState } from 'react';
import { Calculator, Gauge, MapPin, RotateCcw, Waves } from 'lucide-react';

import useStore from '../../store/useStore';
import HazardBottomPanel from '../../components/hazards/HazardBottomPanel';
import { calculateTsunamiHazard } from './api';
import { buildTsunamiInfoPanel } from './infoPanels';

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

const tsunamiResultRows = (result) => {
  if (!result) return [['Potential', 'Not calculated']];
  return [
    ['Potential', `${result.tsunami_potential_class.level}`],
    ['Speed', `${result.tsunami_speed_kmh.toFixed(1)} km/h`],
    ['Wavelength', `${(result.wavelength_m / 1000).toFixed(1)} km`],
    ['Run-up', result.estimated_runup_m == null ? 'Not provided' : `${result.estimated_runup_m.toFixed(2)} m`],
  ];
};

export const useTsunamiWorkflowDockLayout = () => {
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

export default function TsunamiWorkflowDock({ onClose }) {
  return <HazardBottomPanel layout={useTsunamiWorkflowDockLayout()} onClose={onClose} />;
}
