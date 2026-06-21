import React, { useMemo, useState } from 'react';
import { Calculator, MapPin, RotateCcw, Waves } from 'lucide-react';
import { calculateTsunamiHazard, buildTsunamiInfoPanel } from '../hazards/tsunami';
import useStore from '../store/useStore';

const DEFAULT_FORM = {
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

const resultRows = (result) => {
  if (!result) return [];
  return [
    ['Speed', `${result.tsunami_speed_kmh.toFixed(1)} km/h`],
    ['Wavelength', `${(result.wavelength_m / 1000).toFixed(1)} km`],
    ['Initial height', result.initial_wave_height_m == null ? 'Not provided' : `${result.initial_wave_height_m.toFixed(2)} m`],
    ['Abe Mt', result.abe_tsunami_magnitude == null ? 'Not provided' : result.abe_tsunami_magnitude.toFixed(2)],
    ['Run-up', result.estimated_runup_m == null ? 'Not provided' : `${result.estimated_runup_m.toFixed(2)} m`],
  ];
};

export default function TsunamiPanel() {
  const earthquakeEpicenter = useStore((state) => state.earthquakeEpicenter);
  const earthquakeMagnitude = useStore((state) => state.earthquakeMagnitude);
  const setTsunamiResult = useStore((state) => state.setTsunamiResult);
  const setTsunamiSource = useStore((state) => state.setTsunamiSource);
  const clearTsunamiState = useStore((state) => state.clearTsunamiState);
  const setInfoPanel = useStore((state) => state.setInfoPanel);
  const tsunamiResult = useStore((state) => state.tsunamiResult);
  const tsunamiSource = useStore((state) => state.tsunamiSource);

  const [form, setForm] = useState(DEFAULT_FORM);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [bridgeActive, setBridgeActive] = useState(false);

  const sourceSummary = useMemo(() => {
    if (!bridgeActive || !tsunamiSource) return null;
    return `Using current earthquake: M${Number(form.magnitude || 0).toFixed(1)}, ${tsunamiSource.lat.toFixed(4)}, ${tsunamiSource.lng.toFixed(4)}`;
  }, [bridgeActive, form.magnitude, tsunamiSource]);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleUseCurrentEarthquake = () => {
    if (!earthquakeEpicenter) return;
    setBridgeActive(true);
    setTsunamiSource(earthquakeEpicenter);
    setForm((current) => ({
      ...current,
      magnitude: String(earthquakeMagnitude ?? current.magnitude),
      depth_m: current.depth_m || '4000',
      period_s: current.period_s || '1200',
      amplification_factor: current.amplification_factor || '3',
    }));
  };

  const handleClear = () => {
    setForm(DEFAULT_FORM);
    setBridgeActive(false);
    setError('');
    clearTsunamiState();
  };

  const handleCalculate = async () => {
    setIsLoading(true);
    setError('');
    try {
      const payload = {
        magnitude: Number(form.magnitude),
        depth_m: Number(form.depth_m || 4000),
        period_s: Number(form.period_s || 1200),
        seabed_displacement_m: toOptionalNumber(form.seabed_displacement_m),
        wave_height_m: toOptionalNumber(form.wave_height_m),
        distance_km: toOptionalNumber(form.distance_km),
        amplification_factor: Number(form.amplification_factor || 3),
        latitude: tsunamiSource?.lat,
        longitude: tsunamiSource?.lng,
      };
      const result = await calculateTsunamiHazard(payload);
      setTsunamiResult(result);
      setInfoPanel(buildTsunamiInfoPanel(result, tsunamiSource));
    } catch (err) {
      setError(err.message || 'Tsunami calculation failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-cyan-400/30 bg-cyan-950/30 p-3 text-xs text-cyan-100">
        This tsunami estimate is based on simplified empirical formulas and should not be used for official warning or emergency decision-making.
      </div>

      <button
        type="button"
        onClick={handleUseCurrentEarthquake}
        disabled={!earthquakeEpicenter}
        className={`flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2 text-xs font-bold uppercase tracking-wider transition ${
          earthquakeEpicenter
            ? 'border-cyan-500/60 bg-cyan-700/40 text-cyan-50 hover:bg-cyan-600/50'
            : 'cursor-not-allowed border-slate-700 bg-slate-800 text-slate-500'
        }`}
      >
        <MapPin size={15} />
        {earthquakeEpicenter ? 'Use Current Earthquake' : 'Place an earthquake epicenter first'}
      </button>

      {sourceSummary && (
        <div className="rounded border border-slate-600/70 bg-slate-800/60 px-3 py-2 text-xs text-slate-200">
          {sourceSummary}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {[
          ['magnitude', 'Magnitude'],
          ['depth_m', 'Ocean Depth (m)'],
          ['period_s', 'Wave Period (s)'],
          ['amplification_factor', 'Amplification'],
          ['seabed_displacement_m', 'Seabed Shift (m)'],
          ['wave_height_m', 'Wave Height (m)'],
        ].map(([field, label]) => (
          <label key={field} className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            {label}
            <input
              type="number"
              min="0"
              step="0.1"
              value={form[field]}
              onChange={(event) => updateField(field, event.target.value)}
              className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-2 text-sm font-bold text-white focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
            />
          </label>
        ))}
      </div>

      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
        Source Distance (km)
        <input
          type="number"
          min="0"
          step="0.1"
          value={form.distance_km}
          onChange={(event) => updateField('distance_km', event.target.value)}
          className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-2 text-sm font-bold text-white focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
        />
      </label>

      {error && (
        <div className="rounded-lg border border-red-400/50 bg-red-950/40 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleClear}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-600 bg-slate-700 px-4 py-3 text-sm font-bold uppercase tracking-wider text-slate-100 transition hover:bg-slate-600"
        >
          <RotateCcw size={15} />
          Clear
        </button>
        <button
          type="button"
          onClick={handleCalculate}
          disabled={isLoading}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-cyan-500 bg-cyan-600 px-4 py-3 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-cyan-500 disabled:cursor-wait disabled:opacity-70"
        >
          <Calculator size={15} />
          {isLoading ? 'Calculating...' : 'Calculate'}
        </button>
      </div>

      {tsunamiResult && (
        <div className="rounded-lg border border-slate-700/70 bg-slate-800/60 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-bold text-white">
            <Waves size={16} className="text-cyan-300" />
            {tsunamiResult.tsunami_potential_class.level} Potential
          </div>
          <div className="text-xs text-slate-300">{tsunamiResult.tsunami_potential_class.description}</div>
          <dl className="mt-3 space-y-1.5">
            {resultRows(tsunamiResult).map(([label, value]) => (
              <div key={label} className="grid grid-cols-[120px_1fr] gap-2 text-xs">
                <dt className="text-slate-400">{label}</dt>
                <dd className="text-right font-mono text-slate-100">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}
