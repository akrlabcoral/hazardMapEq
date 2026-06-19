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
        <Sidebar isAdmin={false} />
        <MapView isAdmin={false} />
        <MapLayersControl isAdmin={false} />
        <InfoPanel />
        <MapLegend />

        {/* Main Content Overlay */}
        <motion.div
          className="absolute inset-0 pointer-events-none z-10 flex justify-between p-6 pl-[96px] pr-[96px]"
          initial={{ left: 0 }}
          animate={{ left: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          {/* Left Control Panels (Bottom aligned) */}
          <div className="mt-auto flex gap-4 pointer-events-none items-end [&>*]:pointer-events-auto">
            <AnimatePresence mode="wait">
              {activeSection && (
                <motion.div
                  key={activeSection}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className={activeSection === 'live_events' || activeSection === 'historic_events' ? 'w-[360px]' : 'w-[480px]'}
                >
                  {activeSection === 'live_events' ? (
                    <div className="h-[500px]">
                      <LiveEventsPanel />
                    </div>
                  ) : activeSection === 'historic_events' ? (
                    <div className="h-[500px]">
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

          {/* Right Control Panels (Center aligned vertically) */}
          <div className="flex flex-col justify-center gap-4 pointer-events-none [&>*]:pointer-events-auto h-full">
            <AnimatePresence mode="wait">
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
