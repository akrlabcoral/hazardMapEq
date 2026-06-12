import { useEffect, useRef, useCallback } from 'react';
import useStore from '../store/useStore';
import { debugLog } from '../utils/debug';

/**
 * useWebSocket — manages a single WebSocket connection to /scientific-api/ws/live.
 *
 * Handles:
 *  - Auto-reconnect on disconnect (3s delay)
 *  - Heartbeat pings (ignored silently)
 *  - earthquake_detected → addLiveEvent + setActiveAlert (M≥6.0)
 *  - simulation_running  → setIsSimulationRunning(true)
 *  - simulation_complete → setSimulationResults() [same hook used by manual sim]
 *  - simulation_error    → setIsSimulationRunning(false)
 *
 * Mount once at the app root (e.g., in Dashboard.jsx).
 */
export function useWebSocket() {
  const wsRef      = useRef(null);
  const retryRef   = useRef(null);
  const mountedRef = useRef(true);

  const setWsConnected     = useStore((s) => s.setWsConnected);
  const addLiveEvent       = useStore((s) => s.addLiveEvent);
  const setActiveAlert     = useStore((s) => s.setActiveAlert);
  const setSimulationResults   = useStore((s) => s.setSimulationResults);
  const setIsSimulationRunning = useStore((s) => s.setIsSimulationRunning);
  const setPendingSimulationRequestId = useStore((s) => s.setPendingSimulationRequestId);
  // autoSimEnabled is read via useStore.getState() inside handleMessage
  // to avoid causing a WebSocket reconnect when the toggle changes.

  const handleMessage = useCallback((msg) => {
    const state = useStore.getState();
    const pendingRequestId = state.pendingSimulationRequestId;
    const isManualSimulation =
      msg.request_id?.startsWith('manual:') || msg.simulation?.triggered_by === 'manual' || msg.triggered_by === 'manual';
    const isOwnManualSimulation = isManualSimulation && msg.request_id === pendingRequestId;

    switch (msg.type) {
      case 'ping':
        // Heartbeat — ignore
        break;

      case 'earthquake_detected':
        addLiveEvent(msg.event);
        if (msg.event.magnitude >= 6.0 && msg.event.is_relevant) {
          setActiveAlert(msg.event);
        }
        break;

      case 'simulation_running':
        // Read autoSimEnabled at call time to avoid stale closure / reconnect loop
        if (isOwnManualSimulation || (!isManualSimulation && state.autoSimEnabled)) {
          setIsSimulationRunning(true);
        }
        break;

      case 'simulation_complete':
        if (isOwnManualSimulation) {
          setIsSimulationRunning(false);
          setPendingSimulationRequestId(null);
          setSimulationResults(msg.simulation);
        } else if (!isManualSimulation && state.autoSimEnabled) {
          setIsSimulationRunning(false);
          // Exact same setter used by manual simulation — zero map code changes
          setSimulationResults(msg.simulation);
        }
        break;

      case 'simulation_error':
        if (isOwnManualSimulation || (!isManualSimulation && !msg.request_id)) {
          setIsSimulationRunning(false);
          if (isOwnManualSimulation) {
            setPendingSimulationRequestId(null);
          }
        }
        console.warn('[WS] Auto-simulation error:', msg.error);
        break;

      default:
        break;
    }
  }, [addLiveEvent, setActiveAlert, setSimulationResults, setIsSimulationRunning, setPendingSimulationRequestId]);
  // Note: autoSimEnabled intentionally omitted from deps — read via getState() above
  // to avoid triggering a WebSocket reconnect every time the toggle changes.

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';

    // Always use the current window's host so it works via Cloudflare tunnel,
    // LAN, or localhost — the Vite proxy handles routing to the backend.
    const url = `${protocol}//${location.host}/scientific-api/ws/live`;

    debugLog('[WS] Connecting to', url);
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      setWsConnected(true);
      debugLog('[WS] Connected');
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        handleMessage(msg);
      } catch (err) {
        console.warn('[WS] Failed to parse message:', err);
      }
    };

    ws.onclose = () => {
      setWsConnected(false);
      if (mountedRef.current) {
        debugLog('[WS] Disconnected — reconnecting in 3s...');
        retryRef.current = setTimeout(connect, 3000);
      }
    };

    ws.onerror = (err) => {
      console.warn('[WS] Error:', err);
    };
  }, [handleMessage, setWsConnected]);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      clearTimeout(retryRef.current);
      wsRef.current?.close();
    };
  }, [connect]);
}
