import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Loader2, MapPin, Play, RotateCcw } from 'lucide-react';

import useStore from '../../../store/useStore';
import {
  getTsunamiAnalysisLayers,
  getTsunamiAnalysisResult,
  startTsunamiAnalysis,
} from '../api';
import { getTsunamiAlertColor, summarizeTsunamiAnalysis } from '../analysisSummary';

const DEFAULT_FORM = {
  magnitude: '7.0',
  latitude: '',
  longitude: '',
  depth_km: '10',
  offshore_wave_height_m: '1',
  strike_deg: '0',
  dip_deg: '15',
  rake_deg: '90',
  mechanism: 'thrust',
  max_targets: '100',
  target_spacing_km: '50',
  coastal_depth_m: '10',
  amplification_factor: '1.5',
  max_coast_points: '50',
  coast_spacing_km: '25',
  transect_length_km: '10',
  transect_spacing_m: '250',
  include_damage_assessment: true,
};

const toNumber = (value, fallback = undefined) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const NumberInput = ({ label, value, onChange, step = '0.1' }) => (
  <label className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
    {label}
    <input
      type="number"
      step={step}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="mt-1 h-9 w-full rounded border border-slate-600 bg-slate-950 px-2 text-sm font-bold text-white focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
    />
  </label>
);

const buildAnalysisPayload = (form) => {
  const latitude = toNumber(form.latitude);
  const longitude = toNumber(form.longitude);
  const magnitude = toNumber(form.magnitude, 0);
  return {
    source_model: {
      magnitude,
      latitude,
      longitude,
      depth_km: toNumber(form.depth_km, 10),
      strike_deg: toNumber(form.strike_deg, 0),
      dip_deg: toNumber(form.dip_deg, 15),
      rake_deg: toNumber(form.rake_deg, 90),
      mechanism: form.mechanism || 'thrust',
    },
    wave_propagation: {
      source_latitude: latitude,
      source_longitude: longitude,
      magnitude,
      offshore_wave_height_m: toNumber(form.offshore_wave_height_m, undefined),
      max_targets: toNumber(form.max_targets, 100),
      target_spacing_km: toNumber(form.target_spacing_km, 50),
      coastal_depth_m: toNumber(form.coastal_depth_m, 10),
      amplification_factor: toNumber(form.amplification_factor, 1.5),
    },
    inundation: {
      wave_height_m: toNumber(form.offshore_wave_height_m, 1),
      source_latitude: latitude,
      source_longitude: longitude,
      max_coast_points: toNumber(form.max_coast_points, 50),
      coast_spacing_km: toNumber(form.coast_spacing_km, 25),
      transect_length_km: toNumber(form.transect_length_km, 10),
      transect_spacing_m: toNumber(form.transect_spacing_m, 250),
    },
    include_damage_assessment: Boolean(form.include_damage_assessment),
  };
};

export default function TsunamiInputPanel() {
  const earthquakeEpicenter = useStore((state) => state.earthquakeEpicenter);
  const earthquakeMagnitude = useStore((state) => state.earthquakeMagnitude);
  const setTsunamiSource = useStore((state) => state.setTsunamiSource);
  const setTsunamiResult = useStore((state) => state.setTsunamiResult);
  const setTsunamiAnalysisRequestId = useStore((state) => state.setTsunamiAnalysisRequestId);
  const setTsunamiAnalysisStatus = useStore((state) => state.setTsunamiAnalysisStatus);
  const setTsunamiAnalysisResult = useStore((state) => state.setTsunamiAnalysisResult);
  const setTsunamiAnalysisLayers = useStore((state) => state.setTsunamiAnalysisLayers);
  const setTsunamiAnalysisError = useStore((state) => state.setTsunamiAnalysisError);
  const setIsTsunamiAnalysisRunning = useStore((state) => state.setIsTsunamiAnalysisRunning);
  const forceActivePanel = useStore((state) => state.forceActivePanel);
  const isRunning = useStore((state) => state.isTsunamiAnalysisRunning);
  const activeRequestId = useStore((state) => state.tsunamiAnalysisRequestId);
  const error = useStore((state) => state.tsunamiAnalysisError);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const pollTimer = useRef(null);

  useEffect(() => () => {
    if (pollTimer.current) clearTimeout(pollTimer.current);
  }, []);

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const useCurrentEarthquake = () => {
    if (!earthquakeEpicenter) return;
    setTsunamiSource(earthquakeEpicenter);
    setForm((current) => ({
      ...current,
      magnitude: String(earthquakeMagnitude ?? current.magnitude),
      latitude: String(earthquakeEpicenter.lat),
      longitude: String(earthquakeEpicenter.lng),
    }));
  };

  const finishCompletedAnalysis = async (requestId, result) => {
    const resultJson = result.result_json || {};
    const layers = await getTsunamiAnalysisLayers(requestId).catch(() => null);
    const sourceInputs = resultJson.source_model?.inputs || {};
    const summary = summarizeTsunamiAnalysis(resultJson);
    const source = {
      lat: Number(sourceInputs.latitude),
      lng: Number(sourceInputs.longitude),
    };

    setTsunamiAnalysisResult(resultJson);
    setTsunamiAnalysisLayers(layers?.layers || resultJson.layers || null);
    setTsunamiSource(Number.isFinite(source.lat) && Number.isFinite(source.lng) ? source : null);
    setTsunamiResult({
      ...resultJson,
      tsunami_potential_class: {
        level: summary.alertLevel,
        description: 'Async tsunami analysis result',
      },
    });
    setTsunamiAnalysisStatus('completed');
    setIsTsunamiAnalysisRunning(false);
    forceActivePanel('results');
  };

  const pollResult = (requestId) => {
    pollTimer.current = setTimeout(async () => {
      try {
        const result = await getTsunamiAnalysisResult(requestId);
        setTsunamiAnalysisStatus(result.status);
        if (result.status === 'completed') {
          await finishCompletedAnalysis(requestId, result);
          return;
        }
        if (result.status === 'failed') {
          setTsunamiAnalysisError(result.error || 'Tsunami analysis failed');
          setIsTsunamiAnalysisRunning(false);
          return;
        }
        pollResult(requestId);
      } catch (err) {
        setTsunamiAnalysisError(err.message || 'Could not fetch tsunami analysis status');
        setIsTsunamiAnalysisRunning(false);
      }
    }, 1500);
  };

  const runAnalysis = async () => {
    setTsunamiAnalysisError('');
    setIsTsunamiAnalysisRunning(true);
    setTsunamiAnalysisStatus('queued');
    try {
      const payload = buildAnalysisPayload(form);
      const accepted = await startTsunamiAnalysis(payload);
      setTsunamiAnalysisRequestId(accepted.request_id);
      pollResult(accepted.request_id);
    } catch (err) {
      setTsunamiAnalysisError(err.message || 'Tsunami analysis failed to start');
      setIsTsunamiAnalysisRunning(false);
      setTsunamiAnalysisStatus('failed');
    }
  };

  const reset = () => {
    setForm(DEFAULT_FORM);
    setTsunamiAnalysisError('');
    setTsunamiAnalysisStatus('idle');
  };

  const canRun = form.latitude !== '' && form.longitude !== '' && !isRunning;

  return (
    <div className="space-y-4">
      <div className="rounded border border-cyan-400/30 bg-cyan-950/30 p-3 text-xs leading-relaxed text-cyan-100">
        This tsunami estimate is based on simplified empirical formulas and should not be used for official warning or emergency decision-making.
      </div>

      <button
        type="button"
        onClick={useCurrentEarthquake}
        disabled={!earthquakeEpicenter}
        className={`flex w-full items-center justify-center gap-2 rounded border px-3 py-2 text-xs font-bold uppercase tracking-wider transition ${
          earthquakeEpicenter
            ? 'border-cyan-500/60 bg-cyan-700/40 text-cyan-50 hover:bg-cyan-600/50'
            : 'cursor-not-allowed border-slate-700 bg-slate-800 text-slate-500'
        }`}
      >
        <MapPin size={15} />
        {earthquakeEpicenter ? 'Use Current Earthquake' : 'Place an earthquake epicenter first'}
      </button>

      <div className="grid grid-cols-2 gap-3">
        <NumberInput label="Magnitude" value={form.magnitude} onChange={(value) => updateField('magnitude', value)} />
        <NumberInput label="Depth (km)" value={form.depth_km} onChange={(value) => updateField('depth_km', value)} />
        <NumberInput label="Latitude" value={form.latitude} onChange={(value) => updateField('latitude', value)} />
        <NumberInput label="Longitude" value={form.longitude} onChange={(value) => updateField('longitude', value)} />
        <NumberInput label="Wave Height (m)" value={form.offshore_wave_height_m} onChange={(value) => updateField('offshore_wave_height_m', value)} />
      </div>

      <button
        type="button"
        onClick={() => setShowAdvanced((value) => !value)}
        className="flex w-full items-center justify-between rounded border border-slate-700 bg-slate-800/70 px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-200"
      >
        Advanced Controls
        <ChevronDown className={`h-4 w-4 transition ${showAdvanced ? 'rotate-180' : ''}`} />
      </button>

      {showAdvanced && (
        <div className="grid grid-cols-2 gap-3 rounded border border-slate-700/70 bg-slate-900/50 p-3">
          <NumberInput label="Strike" value={form.strike_deg} onChange={(value) => updateField('strike_deg', value)} />
          <NumberInput label="Dip" value={form.dip_deg} onChange={(value) => updateField('dip_deg', value)} />
          <NumberInput label="Rake" value={form.rake_deg} onChange={(value) => updateField('rake_deg', value)} />
          <NumberInput label="Targets" step="1" value={form.max_targets} onChange={(value) => updateField('max_targets', value)} />
          <NumberInput label="Target spacing" value={form.target_spacing_km} onChange={(value) => updateField('target_spacing_km', value)} />
          <NumberInput label="Coastal depth" value={form.coastal_depth_m} onChange={(value) => updateField('coastal_depth_m', value)} />
          <NumberInput label="Amplification" value={form.amplification_factor} onChange={(value) => updateField('amplification_factor', value)} />
          <NumberInput label="Transect km" value={form.transect_length_km} onChange={(value) => updateField('transect_length_km', value)} />
          <label className="col-span-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
            <input
              type="checkbox"
              checked={form.include_damage_assessment}
              onChange={(event) => updateField('include_damage_assessment', event.target.checked)}
            />
            Include damage assessment
          </label>
        </div>
      )}

      {activeRequestId && (
        <div className="rounded border border-slate-700/70 bg-slate-800/60 px-3 py-2 text-xs text-slate-300">
          Request: <span className="font-mono text-slate-100">{activeRequestId}</span>
        </div>
      )}

      {error && (
        <div className="rounded border border-red-400/50 bg-red-950/40 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="flex flex-1 items-center justify-center gap-2 rounded border border-slate-600 bg-slate-700 px-4 py-3 text-sm font-bold uppercase tracking-wider text-slate-100 transition hover:bg-slate-600"
        >
          <RotateCcw size={15} />
          Reset
        </button>
        <button
          type="button"
          onClick={runAnalysis}
          disabled={!canRun}
          className="flex flex-1 items-center justify-center gap-2 rounded border border-cyan-500 bg-cyan-600 px-4 py-3 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
          style={{ boxShadow: canRun ? `0 0 18px ${getTsunamiAlertColor('INFORMATION')}55` : undefined }}
        >
          {isRunning ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
          {isRunning ? 'Running' : 'Analyze'}
        </button>
      </div>
    </div>
  );
}
