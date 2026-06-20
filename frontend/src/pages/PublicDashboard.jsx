import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import MapView from '../components/MapView';
import MapLegend from '../components/MapLegend';
import ControlPanel from '../components/ControlPanel';
import InfoPanel from '../components/InfoPanel';
import AlertBanner from '../components/AlertBanner';
import PublicMapToolbar from '../components/PublicMapToolbar';
import MapLayersControl from '../components/MapLayersControl';
import { AlertsPanel } from '../panels/AlertsPanel';
import useStore from '../store/useStore';
import { useWebSocket } from '../hooks/useWebSocket';

import LiveEventsPanel from '../panels/LiveEventsPanel';
import HistoricPanel from '../panels/HistoricPanel';

const PANEL_TITLE = {
  alerts:    'ALERTS',
};

export default function PublicDashboard() {
  const activeSection = useStore((s) => s.activeSection);
  const forceActiveSection = useStore((s) => s.forceActiveSection);

  // On mount, if no section is active (or if an admin-only section like disasters leaked over), default to live_events
  useEffect(() => {
    // Read fresh state to avoid closure staleness in StrictMode
    const current = useStore.getState().activeSection;
    if (!current || current === 'disasters' || current === 'layers') {
      forceActiveSection('live_events');
    }
    useStore.setState((state) => ({
      gisLayers: {
        ...state.gisLayers,
        satellite: true,
        gpsVectors: true,
      },
    }));
  }, [forceActiveSection]);

  // Start WebSocket connection — real-time earthquake events + auto-sim results
  useWebSocket();

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Global alert banner for M≥5.0 auto-detected events */}
      <AlertBanner />
      <Navbar isAdmin={false} />
      <PublicMapToolbar />

      <div className="flex-1 relative flex overflow-hidden">
        <MapView isAdmin={false} />
        <MapLayersControl isAdmin={false} />
        <InfoPanel />
        <MapLegend />

        {/* Left Column Overlay (Sidebar + Panels) */}
        <div className="absolute inset-y-0 left-0 pointer-events-none z-10 flex flex-col w-[260px]">
          <div className="pointer-events-auto">
            <Sidebar isAdmin={false} />
          </div>

          <div className="flex-1 pt-0 pb-0 pointer-events-none [&>*]:pointer-events-auto flex flex-col min-h-0">
            <AnimatePresence mode="wait">
              {activeSection && (
                <motion.div
                  key={activeSection}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="w-[260px] h-full flex flex-col"
                >
                  {activeSection === 'live_events' ? (
                    <div className="min-h-0 flex-1">
                      <LiveEventsPanel />
                    </div>
                  ) : activeSection === 'historic_events' ? (
                    <div className="min-h-0 flex-1">
                      <HistoricPanel />
                    </div>
                  ) : (
                    PANEL_TITLE[activeSection] && (
                      <ControlPanel title={PANEL_TITLE[activeSection]}>
                        {activeSection === 'alerts' && <AlertsPanel />}
                      </ControlPanel>
                    )
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
