import React, { useEffect, useRef } from 'react';
import { Ambulance, Gauge, Hospital, MapPin, Navigation, Play, RotateCcw, Route, Ruler } from 'lucide-react';

import useStore from '../../store/useStore';
import HazardBottomPanel from '../../components/hazards/HazardBottomPanel';
import { useSimulation } from './useSimulation';
import { createEvacuationPlan, findNearestHospitalRoute } from '../../services/evacuation/api';

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

const formatDistance = (meters) => {
  const value = Number(meters);
  if (!Number.isFinite(value)) return 'N/A';
  return value >= 1000 ? `${(value / 1000).toFixed(1)} km` : `${Math.round(value)} m`;
};

const formatDuration = (seconds) => {
  const value = Number(seconds);
  if (!Number.isFinite(value)) return 'N/A';
  const minutes = Math.round(value / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
};

const routeSummaryText = (summary) => {
  const distanceMeters = Number.isFinite(Number(summary?.distance_m))
    ? Number(summary.distance_m)
    : Number(summary?.distance_km) * 1000;
  const durationSeconds = Number.isFinite(Number(summary?.duration_s))
    ? Number(summary.duration_s)
    : Number(summary?.duration_min) * 60;
  return `${formatDistance(distanceMeters)} / ${formatDuration(durationSeconds)}`;
};

const getBestRouteSummary = (routeResponse) => {
  if (!routeResponse?.routes?.length) return null;
  const index = Number.isInteger(routeResponse.best_route_index) ? routeResponse.best_route_index : 0;
  return routeResponse.routes[index] || routeResponse.routes[0];
};

const flattenCoordinates = (coordinates, points = []) => {
  if (!Array.isArray(coordinates)) return points;
  if (typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
    points.push(coordinates);
    return points;
  }
  coordinates.forEach((child) => flattenCoordinates(child, points));
  return points;
};

const featureCenter = (feature) => {
  const points = flattenCoordinates(feature?.geometry?.coordinates);
  if (!points.length) return null;
  const bounds = points.reduce((acc, [lng, lat]) => ({
    minLng: Math.min(acc.minLng, lng),
    maxLng: Math.max(acc.maxLng, lng),
    minLat: Math.min(acc.minLat, lat),
    maxLat: Math.max(acc.maxLat, lat),
  }), {
    minLng: Infinity,
    maxLng: -Infinity,
    minLat: Infinity,
    maxLat: -Infinity,
  });
  return {
    lng: (bounds.minLng + bounds.maxLng) / 2,
    lat: (bounds.minLat + bounds.maxLat) / 2,
  };
};

const getPgaValue = (properties = {}) => {
  const value = properties.local_pga ?? properties.pga_final ?? properties.final_pga ?? properties.pga;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const topPgaTargets = (simulationResults, limit = 3) => (
  simulationResults?.grid_geojson?.features || []
).map((feature) => {
  const center = featureCenter(feature);
  const pga = getPgaValue(feature.properties);
  if (!center || pga === null || pga <= 0) return null;
  return {
    ...center,
    pga,
    state: feature.properties?.state || feature.properties?.STATE || '',
    risk_category: feature.properties?.risk_category || feature.properties?.risk_level || feature.properties?.severity || '',
  };
}).filter(Boolean).sort((a, b) => b.pga - a.pga).slice(0, limit);

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
  const simulationResults = useStore((state) => state.simulationResults);
  const clearSimulationState = useStore((state) => state.clearSimulationState);
  const evacuationOrigin = useStore((state) => state.evacuationOrigin);
  const evacuationTarget = useStore((state) => state.evacuationTarget);
  const evacuationPlan = useStore((state) => state.evacuationPlan);
  const evacuationError = useStore((state) => state.evacuationError);
  const isEvacuationLoading = useStore((state) => state.isEvacuationLoading);
  const isEvacuationModeEnabled = useStore((state) => state.isEvacuationModeEnabled);
  const autoEvacuationPlans = useStore((state) => state.autoEvacuationPlans);
  const autoEvacuationError = useStore((state) => state.autoEvacuationError);
  const isAutoEvacuationLoading = useStore((state) => state.isAutoEvacuationLoading);
  const isPlacingEvacuationOrigin = useStore((state) => state.isPlacingEvacuationOrigin);
  const isSelectingEvacuationTarget = useStore((state) => state.isSelectingEvacuationTarget);
  const setEvacuationPlan = useStore((state) => state.setEvacuationPlan);
  const setEvacuationError = useStore((state) => state.setEvacuationError);
  const setIsEvacuationLoading = useStore((state) => state.setIsEvacuationLoading);
  const setIsEvacuationModeEnabled = useStore((state) => state.setIsEvacuationModeEnabled);
  const setAutoEvacuationPlans = useStore((state) => state.setAutoEvacuationPlans);
  const setAutoEvacuationError = useStore((state) => state.setAutoEvacuationError);
  const setIsAutoEvacuationLoading = useStore((state) => state.setIsAutoEvacuationLoading);
  const setIsPlacingEvacuationOrigin = useStore((state) => state.setIsPlacingEvacuationOrigin);
  const setIsSelectingEvacuationTarget = useStore((state) => state.setIsSelectingEvacuationTarget);
  const { handleRunSimulation } = useSimulation();
  const autoRunKey = useRef(null);

  const updateEpicenter = (field, value) => {
    const parsed = parseFloat(value);
    setEarthquakeEpicenter({
      lat: field === 'lat' ? (Number.isNaN(parsed) ? 0 : parsed) : earthquakeEpicenter?.lat ?? 22.5726,
      lng: field === 'lng' ? (Number.isNaN(parsed) ? 0 : parsed) : earthquakeEpicenter?.lng ?? 88.3639,
    });
  };

  const runEvacuationPlan = async () => {
    if (!evacuationOrigin || !evacuationTarget) {
      setEvacuationError('Set responder origin and select a high-risk zone first.');
      return;
    }
    setIsEvacuationLoading(true);
    setEvacuationError('');
    setEvacuationPlan(null);
    try {
      const plan = await createEvacuationPlan({
        responder_origin: { lat: evacuationOrigin.lat, lon: evacuationOrigin.lng ?? evacuationOrigin.lon },
        vulnerable_zone: { lat: evacuationTarget.lat, lon: evacuationTarget.lng ?? evacuationTarget.lon },
        costing: 'auto',
        hospital_type: 'any',
        search_radius_km: 75,
      });
      setEvacuationPlan(plan);
    } catch (error) {
      setEvacuationError(error.message || 'Could not generate evacuation route.');
    } finally {
      setIsEvacuationLoading(false);
    }
  };

  const toggleOriginPlacement = () => {
    setIsPlacingEpicenter(false);
    setIsSelectingEvacuationTarget(false);
    setIsPlacingEvacuationOrigin(!isPlacingEvacuationOrigin);
  };

  const toggleTargetSelection = () => {
    setIsPlacingEpicenter(false);
    setIsPlacingEvacuationOrigin(false);
    setIsSelectingEvacuationTarget(!isSelectingEvacuationTarget);
  };

  useEffect(() => {
    if (!isEvacuationModeEnabled) return;
    if (!simulationResults?.grid_geojson?.features?.length) return;

    const key = simulationResults;
    if (autoRunKey.current === key) return;
    autoRunKey.current = key;

    let cancelled = false;
    const runAutoEvacuation = async () => {
      const targets = topPgaTargets(simulationResults, 3);
      if (!targets.length) {
        setAutoEvacuationError('No valid PGA grid cells found for auto evacuation.');
        return;
      }

      setIsAutoEvacuationLoading(true);
      setAutoEvacuationError('');
      const results = [];
      const failures = [];

      for (const [index, target] of targets.entries()) {
        if (cancelled) return;
        try {
          const plan = await findNearestHospitalRoute({
            origin: { lat: target.lat, lon: target.lng },
            costing: 'auto',
            hospital_type: 'any',
            search_radius_km: 75,
          });
          results.push({ rank: index + 1, target, plan });
          setAutoEvacuationPlans([...results]);
        } catch (error) {
          failures.push(`#${index + 1}: ${error.message || 'route failed'}`);
          results.push({ rank: index + 1, target, error: error.message || 'Route failed' });
          setAutoEvacuationPlans([...results]);
        }
      }

      if (!cancelled) {
        setAutoEvacuationError(failures.length ? `Some auto routes failed: ${failures.join(', ')}` : '');
        setIsAutoEvacuationLoading(false);
      }
    };

    runAutoEvacuation().catch((error) => {
      if (!cancelled) {
        setAutoEvacuationError(error.message || 'Auto evacuation routing failed.');
        setIsAutoEvacuationLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    isEvacuationModeEnabled,
    setAutoEvacuationError,
    setAutoEvacuationPlans,
    setIsAutoEvacuationLoading,
    simulationResults,
  ]);

  const toggleAutoEvacuation = () => {
    const next = !isEvacuationModeEnabled;
    setIsEvacuationModeEnabled(next);
    setAutoEvacuationError('');
    if (!next) {
      setAutoEvacuationPlans([]);
      setIsAutoEvacuationLoading(false);
      autoRunKey.current = null;
    }
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
      {
        id: 'evacuation',
        title: 'Evacuation',
        icon: Ambulance,
        accent: 'cyan',
        content: (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-slate-600 bg-slate-950/45 px-2 py-2">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-300">Evacuation Mode</div>
                <div className="text-[10px] text-slate-500">Auto-route top 3 highest-PGA cells</div>
              </div>
              <button
                type="button"
                onClick={toggleAutoEvacuation}
                className={`relative h-6 w-11 rounded-full border transition ${
                  isEvacuationModeEnabled
                    ? 'border-cyan-300 bg-cyan-500/60'
                    : 'border-slate-600 bg-slate-800'
                }`}
                aria-pressed={isEvacuationModeEnabled}
                aria-label="Toggle evacuation mode"
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${isEvacuationModeEnabled ? 'left-5' : 'left-0.5'}`} />
              </button>
            </div>

            {isEvacuationModeEnabled && !simulationResults && (
              <div className="rounded-lg border border-cyan-400/25 bg-cyan-500/10 px-2 py-1.5 text-xs font-semibold text-cyan-100">
                Waiting for simulation results.
              </div>
            )}

            {isAutoEvacuationLoading && (
              <div className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-2 py-1.5 text-xs font-semibold text-cyan-100">
                Generating nearest-hospital routes for highest-PGA cells...
              </div>
            )}

            {autoEvacuationError && (
              <div className="rounded-lg border border-yellow-400/40 bg-yellow-500/10 px-2 py-1.5 text-xs font-semibold text-yellow-100">
                {autoEvacuationError}
              </div>
            )}

            {autoEvacuationPlans.length > 0 && (
              <div className="space-y-2">
                {autoEvacuationPlans.map((entry) => (
                  <div key={entry.rank} className="rounded-lg border border-cyan-400/20 bg-slate-950/40 p-2 text-[11px] text-slate-200">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="font-black uppercase tracking-[0.12em] text-cyan-200">#{entry.rank} PGA {Number(entry.target?.pga || 0).toFixed(3)}g</span>
                      <span className="text-right text-slate-400">{entry.target?.state || 'Grid cell'}</span>
                    </div>
                    {entry.plan ? (
                      <div className="grid gap-1">
                        <div className="flex justify-between gap-2">
                          <span className="text-slate-500">Hospital route</span>
                          <span className="font-mono">{routeSummaryText(getBestRouteSummary(entry.plan))}</span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-slate-500">Hospital</span>
                          <span className="text-right font-bold">{entry.plan.hospital?.name || 'Nearest hospital'}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="font-semibold text-red-100">{entry.error || 'Route failed'}</div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={toggleOriginPlacement}
                className={`rounded-lg border px-2 py-2 text-[10px] font-black uppercase tracking-[0.14em] transition ${
                  isPlacingEvacuationOrigin
                    ? 'border-cyan-300 bg-cyan-500/20 text-cyan-100'
                    : 'border-slate-600 bg-slate-900/70 text-slate-200 hover:border-cyan-400'
                }`}
              >
                <Navigation className="mr-1 inline h-3.5 w-3.5" />
                {isPlacingEvacuationOrigin ? 'Cancel Origin' : 'Set Origin'}
              </button>
              <button
                type="button"
                onClick={toggleTargetSelection}
                disabled={!simulationResults}
                className={`rounded-lg border px-2 py-2 text-[10px] font-black uppercase tracking-[0.14em] transition disabled:cursor-not-allowed disabled:opacity-45 ${
                  isSelectingEvacuationTarget
                    ? 'border-orange-300 bg-orange-500/20 text-orange-100'
                    : 'border-slate-600 bg-slate-900/70 text-slate-200 hover:border-orange-400'
                }`}
              >
                <MapPin className="mr-1 inline h-3.5 w-3.5" />
                {isSelectingEvacuationTarget ? 'Cancel Zone' : 'Pick Zone'}
              </button>
            </div>

            <div className="space-y-1 rounded-lg bg-slate-950/45 p-2 text-[11px] text-slate-300">
              <div className="flex justify-between gap-2"><span className="text-slate-500">Origin</span><span className="text-right font-mono">{formatCoords(evacuationOrigin)}</span></div>
              <div className="flex justify-between gap-2"><span className="text-slate-500">Zone</span><span className="text-right font-mono">{formatCoords(evacuationTarget)}</span></div>
            </div>

            {evacuationError && (
              <div className="rounded-lg border border-red-400/40 bg-red-500/10 px-2 py-1.5 text-xs font-semibold text-red-100">
                {evacuationError}
              </div>
            )}

            {evacuationPlan && (
              <div className="space-y-2 rounded-lg border border-cyan-400/20 bg-cyan-400/10 p-2 text-xs text-slate-100">
                <div className="flex items-center gap-2 font-black uppercase tracking-[0.12em] text-cyan-200">
                  <Route className="h-4 w-4" />
                  Route ready
                </div>
                <div className="grid gap-1 text-[11px]">
                  <div className="flex justify-between"><span className="text-slate-400">Responder to zone</span><span className="font-mono">{routeSummaryText(getBestRouteSummary(evacuationPlan.responder_route))}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Zone to hospital</span><span className="font-mono">{routeSummaryText(getBestRouteSummary(evacuationPlan.hospital_route))}</span></div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-slate-400"><Hospital className="mr-1 inline h-3.5 w-3.5" />Hospital</span>
                    <span className="text-right font-bold">{evacuationPlan.hospital_route?.hospital?.name || 'Nearest hospital'}</span>
                  </div>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={runEvacuationPlan}
              disabled={!evacuationOrigin || !evacuationTarget || isEvacuationLoading}
              className="w-full rounded-lg border border-cyan-400/60 bg-cyan-500/20 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-cyan-50 transition hover:bg-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {isEvacuationLoading ? 'Generating...' : 'Generate Plan'}
            </button>
          </div>
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
