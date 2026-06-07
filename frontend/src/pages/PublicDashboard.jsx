import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import MapView from '../components/MapView';
import MapLegend from '../components/MapLegend';
import ControlPanel from '../components/ControlPanel';
import StateHoverTooltip from '../components/StateHoverTooltip';
import StateAnalysisPanel from '../components/StateAnalysisPanel';
import AlertBanner from '../components/AlertBanner';
import { LayersPanel } from '../panels/LayersPanel';
import { AlertsPanel } from '../panels/AlertsPanel';
import RightSidebar from '../components/RightSidebar';
import RightControlPanel from '../components/RightControlPanel';
import useStore from '../store/useStore';
import { useWebSocket } from '../hooks/useWebSocket';

import LiveEventsPanel from '../panels/LiveEventsPanel';

const PANEL_TITLE = {
  layers:    'MAP LAYERS',
  alerts:    'ALERTS',
};

export default function PublicDashboard() {
  const activeSection = useStore((s) => s.activeSection);
  const setActiveSection = useStore((s) => s.setActiveSection);
  const forceActiveSection = useStore((s) => s.forceActiveSection);
  const activeRightSection = useStore((s) => s.activeRightSection);

  // On mount, if no section is active (or if an admin-only section like disasters leaked over), default to live_events
  useEffect(() => {
    // Read fresh state to avoid closure staleness in StrictMode
    const current = useStore.getState().activeSection;
    if (!current || current === 'disasters') {
      forceActiveSection('live_events');
    }
    // Force light theme for public dashboard
    useStore.setState({ mapStyle: 'light' });
  }, [forceActiveSection]);

  // Start WebSocket connection — real-time earthquake events + auto-sim results
  useWebSocket();

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Global alert banner for M≥5.0 auto-detected events */}
      <AlertBanner />
      <Navbar isAdmin={false} />

      <div className="flex-1 relative flex overflow-hidden">
        <Sidebar isAdmin={false} />
        <RightSidebar />
        <MapView isAdmin={false} />
        <StateHoverTooltip />
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
                  className="w-[480px]"
                >
                  {activeSection === 'live_events' ? (
                    <div className="h-[500px]">
                      <LiveEventsPanel />
                    </div>
                  ) : (
                    PANEL_TITLE[activeSection] && (
                      <ControlPanel title={PANEL_TITLE[activeSection]}>
                        {activeSection === 'layers' && <LayersPanel isAdmin={false} />}
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
              {activeRightSection === 'analysis' && (
                <motion.div
                  key="analysis"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="w-[400px]"
                >
                  <RightControlPanel title="STATE ANALYSIS">
                    <StateAnalysisPanel />
                  </RightControlPanel>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
