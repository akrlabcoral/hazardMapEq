import { useCallback, useEffect, useRef, useState } from 'react';
import useStore from '../store/useStore';
import { debugLog } from '../utils/debug';
import { buildSimulationInfoPanel } from '../services/featureInspectionManager';

export function useSimulation() {
  const setSimulationResults   = useStore((s) => s.setSimulationResults);
  const setIsSimulationRunning = useStore((s) => s.setIsSimulationRunning);
  const setPendingSimulationRequestId = useStore((s) => s.setPendingSimulationRequestId);
  const setPendingSimulationInfoPanel = useStore((s) => s.setPendingSimulationInfoPanel);
  
  const [error, setError] = useState(null);
  const pollTimeoutRef = useRef(null);
  const pollAbortRef = useRef(null);

  const stopPolling = useCallback(() => {
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
    if (pollAbortRef.current) {
      pollAbortRef.current.abort();
      pollAbortRef.current = null;
    }
  }, []);

  const pollSimulationStatus = useCallback((requestId) => {
    stopPolling();
    const startedAt = Date.now();
    const nextPollDelay = () => (Date.now() - startedAt < 10 * 1000 ? 500 : 2000);
    const poll = async () => {
      if (useStore.getState().pendingSimulationRequestId !== requestId) return;
      if (Date.now() - startedAt > 5 * 60 * 1000) {
        setError('Simulation timed out. Please try again.');
        setIsSimulationRunning(false);
        setPendingSimulationRequestId(null);
        return;
      }

      try {
        const controller = new AbortController();
        pollAbortRef.current = controller;
        const response = await fetch(
          `/scientific-api/simulate-earthquake/status/${encodeURIComponent(requestId)}`,
          { signal: controller.signal }
        );
        if (!response.ok) throw new Error(`Status request failed: ${response.status}`);
        const status = await response.json();
        if (pollAbortRef.current === controller) {
          pollAbortRef.current = null;
        }

        if (status.status === 'completed' && status.result_json) {
          const state = useStore.getState();
          const epicenter = state.earthquakeEpicenter;
          const eventContext = epicenter ? {
            latitude: epicenter.lat,
            longitude: epicenter.lng,
            magnitude: state.earthquakeMagnitude,
            depth_km: state.earthquakeDepth,
          } : null;
          setSimulationResults(status.result_json);
          setPendingSimulationInfoPanel(buildSimulationInfoPanel(status.result_json, epicenter, eventContext));
          setIsSimulationRunning(false);
          setPendingSimulationRequestId(null);
          return;
        }

        if (status.status === 'failed') {
          throw new Error(status.error || 'Simulation failed');
        }
      } catch (err) {
        if (err.name === 'AbortError') return;
        pollAbortRef.current = null;
        console.warn('[Sim] Status polling error:', err);
      }

      pollTimeoutRef.current = setTimeout(poll, nextPollDelay());
    };

    pollTimeoutRef.current = setTimeout(poll, 500);
  }, [setSimulationResults, setIsSimulationRunning, setPendingSimulationRequestId, setPendingSimulationInfoPanel, stopPolling]);

  const handleRunSimulation = useCallback(async () => {
    const state = useStore.getState();
    const epicenter = state.earthquakeEpicenter;
    const magnitude = state.earthquakeMagnitude;
    const depth = state.earthquakeDepth;

    if (!epicenter) return;

    stopPolling();
    setIsSimulationRunning(true);
    setError(null);
    setSimulationResults(null); // Clear previous results
    setPendingSimulationInfoPanel(null);

    try {
      const payload = {
        latitude: epicenter.lat,
        longitude: epicenter.lng,
        magnitude: magnitude,
        depth: depth,
      };
      
      const response = await fetch('/scientific-api/simulate-earthquake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      debugLog('[Sim] API payload sent:', { lat: epicenter.lat, lng: epicenter.lng, magnitude, depth });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.detail || `Server returned ${response.status}`);
      }

      const result = await response.json();
      if (result.request_id) {
        setPendingSimulationRequestId(result.request_id);
        pollSimulationStatus(result.request_id);
      } else {
        setSimulationResults(result);
        setPendingSimulationInfoPanel(buildSimulationInfoPanel(result, epicenter, {
          latitude: epicenter.lat,
          longitude: epicenter.lng,
          magnitude,
          depth_km: depth,
        }));
        setIsSimulationRunning(false);
      }
      
    } catch (err) {
      console.error('[Sim] Scientific API error:', err);
      setError(err.message);
      setIsSimulationRunning(false);
    }
  }, [setSimulationResults, setIsSimulationRunning, setPendingSimulationRequestId, setPendingSimulationInfoPanel, pollSimulationStatus, stopPolling]);

  useEffect(() => stopPolling, [stopPolling]);

  return { handleRunSimulation, error };
}
