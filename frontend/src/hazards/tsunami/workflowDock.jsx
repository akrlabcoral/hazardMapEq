import React, { useEffect, useRef } from 'react';
import { 
  AlertTriangle, 
  BarChart3, 
  Clock, 
  MapPin, 
  Play, 
  RotateCcw, 
  Users, 
  Waves 
} from 'lucide-react';

import useStore from '../../store/useStore';
import HazardBottomPanel from '../../components/hazards/HazardBottomPanel';
import {
  getTsunamiAnalysisLayers,
  getTsunamiAnalysisResult,
  startTsunamiAnalysis,
} from './api';
import { getTsunamiAlertColor, summarizeTsunamiSimulation } from './analysisSummary';
import { TSUNAMI_DEFAULT_FORM } from './state';

const toNumber = (value, fallback = undefined) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const formatMetric = (val, { digits = 1, suffix = '' } = {}) => {
  if (val == null || !Number.isFinite(val)) return 'N/A';
  return `${val.toFixed(digits)}${suffix}`;
};

const NumberInput = ({ label, value, onChange, step = '0.1' }) => (
  <label className="block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
    {label}
    <input
      type="number"
      step={step}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="mt-1 h-9 w-full rounded-lg border border-slate-600 bg-slate-950/80 px-2 text-sm font-bold text-white focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
    />
  </label>
);

const buildAnalysisPayload = (form) => {
  const latitude = toNumber(form.latitude);
  const longitude = toNumber(form.longitude);
  const magnitude = toNumber(form.magnitude, 0);
  const offshoreWaveHeight = toNumber(form.offshore_wave_height_m, undefined);
  const payload = {
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
      max_targets: toNumber(form.max_targets, 100),
      target_spacing_km: toNumber(form.target_spacing_km, 50),
      coastal_depth_m: toNumber(form.coastal_depth_m, 10),
      amplification_factor: toNumber(form.amplification_factor, 1.5),
    },
    include_damage_assessment: Boolean(form.include_damage_assessment),
  };

  if (offshoreWaveHeight !== undefined) {
    payload.wave_propagation.offshore_wave_height_m = offshoreWaveHeight;
    payload.inundation = {
      wave_height_m: offshoreWaveHeight,
      source_latitude: latitude,
      source_longitude: longitude,
      max_coast_points: toNumber(form.max_coast_points, 50),
      coast_spacing_km: toNumber(form.coast_spacing_km, 25),
      transect_length_km: toNumber(form.transect_length_km, 10),
      transect_spacing_m: toNumber(form.transect_spacing_m, 250),
    };
  }

  return payload;
};

export const useTsunamiWorkflowDockLayout = () => {
  const earthquakeEpicenter = useStore((state) => state.earthquakeEpicenter);
  const earthquakeMagnitude = useStore((state) => state.earthquakeMagnitude);
  const setTsunamiSource = useStore((state) => state.setTsunamiSource);
  const setTsunamiResult = useStore((state) => state.setTsunamiResult);
  
  const activeRequestId = useStore((state) => state.tsunamiAnalysisRequestId);
  const setTsunamiAnalysisRequestId = useStore((state) => state.setTsunamiAnalysisRequestId);
  const setTsunamiAnalysisStatus = useStore((state) => state.setTsunamiAnalysisStatus);
  const setTsunamiAnalysisResult = useStore((state) => state.setTsunamiAnalysisResult);
  const setTsunamiAnalysisLayers = useStore((state) => state.setTsunamiAnalysisLayers);
  
  const error = useStore((state) => state.tsunamiAnalysisError);
  const setTsunamiAnalysisError = useStore((state) => state.setTsunamiAnalysisError);
  const isRunning = useStore((state) => state.isTsunamiAnalysisRunning);
  const setIsTsunamiAnalysisRunning = useStore((state) => state.setIsTsunamiAnalysisRunning);
  const isPlacingTsunamiEpicenter = useStore((state) => state.isPlacingTsunamiEpicenter);
  const setIsPlacingTsunamiEpicenter = useStore((state) => state.setIsPlacingTsunamiEpicenter);

  const tsunamiResult = useStore((state) => state.tsunamiAnalysisResult);
  const clearTsunamiState = useStore((state) => state.clearTsunamiState);
  const form = useStore((state) => state.tsunamiSimulationForm || TSUNAMI_DEFAULT_FORM);
  const setTsunamiSimulationForm = useStore((state) => state.setTsunamiSimulationForm);
  const resetTsunamiSimulationForm = useStore((state) => state.resetTsunamiSimulationForm);
  const pollTimer = useRef(null);

  useEffect(() => () => {
    if (pollTimer.current) clearTimeout(pollTimer.current);
  }, []);

  const updateField = (field, value) => setTsunamiSimulationForm({ [field]: value });

  const useCurrentEarthquake = () => {
    if (!earthquakeEpicenter) return;
    setIsPlacingTsunamiEpicenter(false);
    setTsunamiSource(earthquakeEpicenter);
    setTsunamiResult(null);
    setTsunamiAnalysisResult(null);
    setTsunamiAnalysisLayers(null);
    setTsunamiAnalysisRequestId(null);
    setTsunamiAnalysisStatus('idle');
    setTsunamiAnalysisError('');
    setTsunamiSimulationForm({
      magnitude: String(earthquakeMagnitude ?? form.magnitude),
      latitude: String(earthquakeEpicenter.lat),
      longitude: String(earthquakeEpicenter.lng),
    });
  };

  const finishCompletedAnalysis = async (requestId, result) => {
    const resultJson = result.result_json || {};
    const layers = await getTsunamiAnalysisLayers(requestId).catch(() => null);
    const sourceInputs = resultJson.source_model?.inputs || {};
    const summary = summarizeTsunamiSimulation(resultJson);
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
        description: 'Async tsunami simulation result',
      },
    });
    setTsunamiAnalysisStatus('completed');
    setIsTsunamiAnalysisRunning(false);
  };

  const pollResult = (requestId) => {
    if (pollTimer.current) clearTimeout(pollTimer.current);
    pollTimer.current = setTimeout(async () => {
      try {
        const result = await getTsunamiAnalysisResult(requestId);
        setTsunamiAnalysisStatus(result.status);
        if (result.status === 'completed') {
          await finishCompletedAnalysis(requestId, result);
          return;
        }
        if (result.status === 'failed') {
          setTsunamiAnalysisError(result.error || 'Tsunami simulation failed');
          setIsTsunamiAnalysisRunning(false);
          return;
        }
        pollResult(requestId);
      } catch (err) {
        setTsunamiAnalysisError(err.message || 'Could not fetch simulation status');
        setIsTsunamiAnalysisRunning(false);
      }
    }, 1500);
  };

  useEffect(() => {
    if (!activeRequestId || !isRunning || pollTimer.current) return;
    pollResult(activeRequestId);
  }, [activeRequestId, isRunning]);

  const runAnalysis = async () => {
    setTsunamiAnalysisError('');
    setIsTsunamiAnalysisRunning(true);
    setIsPlacingTsunamiEpicenter(false);
    setTsunamiAnalysisStatus('queued');
    // Clear any previous results when running a new simulation
    setTsunamiAnalysisResult(null);
    setTsunamiResult(null);
    try {
      const latitude = toNumber(form.latitude);
      const longitude = toNumber(form.longitude);
      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        setTsunamiSource({ lat: latitude, lng: longitude });
      }
      const payload = buildAnalysisPayload(form);
      const accepted = await startTsunamiAnalysis(payload);
      setTsunamiAnalysisRequestId(accepted.request_id);
    } catch (err) {
      setTsunamiAnalysisError(err.message || 'Tsunami simulation failed to start');
      setIsTsunamiAnalysisRunning(false);
      setTsunamiAnalysisStatus('failed');
    }
  };

  const reset = () => {
    resetTsunamiSimulationForm();
    setTsunamiAnalysisError('');
    setTsunamiAnalysisStatus('idle');
    setIsPlacingTsunamiEpicenter(false);
    clearTsunamiState();
  };

  const canRun = form.latitude !== '' && form.longitude !== '' && !isRunning;

  // Render cards based on whether we have results or not
  let sections = [];

  if (tsunamiResult) {
    const summary = summarizeTsunamiSimulation(tsunamiResult);
    const alertColor = getTsunamiAlertColor(summary.alertLevel);
    const sourceInputs = tsunamiResult.source_model?.inputs || {};
    
    sections = [
      {
        id: 'source',
        title: 'Source Details',
        icon: AlertTriangle,
        accent: alertColor,
        content: (
          <div className="space-y-3">
            <div className="flex justify-between items-end border-b border-slate-700 pb-2">
              <span className="text-xs font-semibold text-slate-400">Magnitude</span>
              <span className="font-mono text-lg font-bold text-white">Mw {sourceInputs.magnitude ?? form.magnitude}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="text-slate-400">Lat: <span className="font-mono text-slate-200">{sourceInputs.latitude ?? form.latitude}</span></div>
              <div className="text-slate-400">Lng: <span className="font-mono text-slate-200">{sourceInputs.longitude ?? form.longitude}</span></div>
              <div className="text-slate-400 mt-1 col-span-2">Depth: <span className="font-mono text-slate-200">{sourceInputs.depth_km ?? form.depth_km} km</span></div>
            </div>
          </div>
        ),
      },
      {
        id: 'impact',
        title: 'Impact',
        icon: Waves,
        accent: '#38bdf8',
        content: (
          <div className="space-y-2">
            {summary.waveUnavailableReason && (
              <div className="rounded border border-amber-400/40 bg-amber-950/30 p-2 text-xs font-semibold leading-snug text-amber-100">
                {summary.waveUnavailableReason}
              </div>
            )}
            <div className="flex items-center justify-between rounded bg-slate-800/50 p-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <Clock className="w-4 h-4 text-cyan-400" />
                First ETA
              </div>
              <div className="font-mono text-sm font-bold text-cyan-200">{formatMetric(summary.etaMinutes, { digits: 0, suffix: ' min' })}</div>
            </div>
            <div className="flex items-center justify-between rounded bg-slate-800/50 p-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <Waves className="w-4 h-4 text-blue-400" />
                Max Wave Height
              </div>
              <div className="font-mono text-sm font-bold text-blue-200">{formatMetric(summary.waveHeightM, { digits: 2, suffix: ' m' })}</div>
            </div>
            <div className="rounded bg-slate-800/50 p-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <MapPin className="w-4 h-4 text-sky-400" />
                Most Affected Coast
              </div>
              <div className="mt-1 truncate text-sm font-bold text-sky-100" title={summary.affectedLocation}>
                {summary.affectedLocation}
              </div>
            </div>
          </div>
        ),
      },
      {
        id: 'damage',
        title: 'Damage Estimates',
        icon: BarChart3,
        accent: '#facc15',
        content: (
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded bg-slate-800/50 p-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <Users className="w-4 h-4 text-yellow-400" />
                Affected Pop
              </div>
              <div className="font-mono text-sm font-bold text-yellow-200">{formatMetric(summary.affectedPopulation, { digits: 0 })}</div>
            </div>
          </div>
        ),
      }
    ];
  } else {
    sections = [
      {
        id: 'epicenter',
        title: 'Epicenter & Magnitude',
        icon: MapPin,
        accent: 'cyan',
        content: (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <NumberInput label="Latitude" value={form.latitude} onChange={(value) => updateField('latitude', value)} step="0.0001" />
              <NumberInput label="Longitude" value={form.longitude} onChange={(value) => updateField('longitude', value)} step="0.0001" />
              <NumberInput label="Magnitude (Mw)" value={form.magnitude} onChange={(value) => updateField('magnitude', value)} />
              <NumberInput label="Depth (km)" value={form.depth_km} onChange={(value) => updateField('depth_km', value)} />
            </div>
          </div>
        ),
      },
      {
        id: 'advanced',
        title: 'Advanced Settings',
        icon: BarChart3,
        accent: 'cyan',
        content: (
          <div className="space-y-2">
             <div className="grid grid-cols-2 gap-2">
               <NumberInput label="Wave Height (m)" value={form.offshore_wave_height_m} onChange={(value) => updateField('offshore_wave_height_m', value)} />
               <NumberInput label="Target Spacing (km)" value={form.target_spacing_km} onChange={(value) => updateField('target_spacing_km', value)} />
             </div>
             <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-300 mt-2">
                <input
                  type="checkbox"
                  checked={form.include_damage_assessment}
                  onChange={(event) => updateField('include_damage_assessment', event.target.checked)}
                  className="rounded border-slate-600 bg-slate-900 text-cyan-500 focus:ring-cyan-500"
                />
                Include damage assessment
             </label>
             {error && <div className="text-xs text-red-400 mt-1 font-semibold">{error}</div>}
          </div>
        ),
      }
    ];
  }

  return {
    id: 'tsunami_workflow',
    title: 'Tsunami Simulation',
    eyebrow: 'Simulation Controls',
    status: isRunning ? 'Running' : (tsunamiResult ? 'Completed' : 'Waiting'),
    sections,
    actions: [
      {
        id: 'place',
        label: isPlacingTsunamiEpicenter ? 'Cancel Pin' : 'Drop Pin',
        icon: MapPin,
        onClick: () => setIsPlacingTsunamiEpicenter(!isPlacingTsunamiEpicenter),
        disabled: isRunning,
      },
      { 
        id: 'sync', 
        label: 'Use Earthquake', 
        icon: MapPin, 
        onClick: useCurrentEarthquake,
        disabled: !earthquakeEpicenter 
      },
      { 
        id: 'clear', 
        label: 'Clear', 
        icon: RotateCcw, 
        onClick: reset 
      },
      {
        id: 'run',
        label: isRunning ? 'Running...' : (tsunamiResult ? 'Rerun Sim' : 'Run Sim'),
        icon: Play,
        variant: 'primary',
        disabled: !canRun,
        onClick: runAnalysis,
      },
    ],
  };
};

export default function TsunamiWorkflowDock({ onClose }) {
  return <HazardBottomPanel layout={useTsunamiWorkflowDockLayout()} onClose={onClose} />;
}
