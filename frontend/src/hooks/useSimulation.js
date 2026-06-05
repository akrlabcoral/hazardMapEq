import { useCallback, useState } from 'react';
import useStore from '../store/useStore';

export function useSimulation() {
  const earthquakeEpicenter  = useStore((s) => s.earthquakeEpicenter);
  const earthquakeMagnitude  = useStore((s) => s.earthquakeMagnitude);
  const earthquakeDepth      = useStore((s) => s.earthquakeDepth);
  
  const setSimulationResults   = useStore((s) => s.setSimulationResults);
  const setIsSimulationRunning = useStore((s) => s.setIsSimulationRunning);
  
  const [error, setError] = useState(null);

  const handleRunSimulation = useCallback(async () => {
    const state = useStore.getState();
    const epicenter = state.earthquakeEpicenter;
    const magnitude = state.earthquakeMagnitude;
    const depth = state.earthquakeDepth;

    if (!epicenter) return;

    setIsSimulationRunning(true);
    setError(null);
    setSimulationResults(null); // Clear previous results

    try {
      const hazardLayers = state.hazardLayers;
      const weights = {};
      for (const [id, config] of Object.entries(hazardLayers)) {
          if (config.active) {
              weights[id] = config.weight;
          }
      }
      
      const payload = {
        latitude: epicenter.lat,
        longitude: epicenter.lng,
        magnitude: magnitude,
        depth: depth,
        weights: weights,
      };

      if (state.useCustomGmpe) {
        payload.gmpe_params = state.gmpeParams;
      }
      
      const response = await fetch('/scientific-api/simulate-earthquake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      console.log('[Sim] API payload sent:', { lat: epicenter.lat, lng: epicenter.lng, magnitude, depth });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.detail || `Server returned ${response.status}`);
      }

      const geojsonData = await response.json();
      setSimulationResults(geojsonData);
      
    } catch (err) {
      console.error('[Sim] Scientific API error:', err);
      setError(err.message);
    } finally {
      setIsSimulationRunning(false);
    }
  }, [setSimulationResults, setIsSimulationRunning]);

  return { handleRunSimulation, error };
}
