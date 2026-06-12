// src/pages/Dashboard.jsx
// Main layout shell — composes all panels and map components.
// All business logic has been extracted to dedicated panels and hooks.

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import MapView from '../components/MapView';
import MapLegend from '../components/MapLegend';
import ControlPanel from '../components/ControlPanel';
import InfoPanel from '../components/InfoPanel';
import StateAnalysisPanel from '../components/StateAnalysisPanel';
import UploadProgressManager from '../components/UploadProgressManager';
import AlertBanner from '../components/AlertBanner';
import { DisastersPanel } from '../panels/DisastersPanel';
import { LayersPanel } from '../panels/LayersPanel';
import { AlertsPanel } from '../panels/AlertsPanel';
import RightSidebar from '../components/RightSidebar';
import RightControlPanel from '../components/RightControlPanel';
import useStore from '../store/useStore';
import { useWebSocket } from '../hooks/useWebSocket';
import LiveEventsPanel from '../panels/LiveEventsPanel';
import HistoricPanel from '../panels/HistoricPanel';

const PANEL_TITLE = {
  disasters: 'DISASTERS PANEL',
  layers:    'MAP LAYERS',
  alerts:    'ALERTS',
  historic_events: 'HISTORIC EVENTS',
};

export default function AdminDashboard() {
  const activeSection = useStore((s) => s.activeSection);
  const activeRightSection = useStore((s) => s.activeRightSection);

  // Start WebSocket connection — real-time earthquake events + auto-sim results
  useWebSocket();

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Global alert banner for M≥5.0 auto-detected events */}
      <AlertBanner />
      <Navbar isAdmin={true} />

      <div className="flex-1 relative flex overflow-hidden">
        <Sidebar isAdmin={true} />
        <RightSidebar />
        <MapView isAdmin={true} />
        <InfoPanel />
        <MapLegend />
        <UploadProgressManager />

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
                    <ControlPanel title={PANEL_TITLE[activeSection] ?? activeSection.toUpperCase()}>
                      {activeSection === 'disasters' && <DisastersPanel />}
                      {activeSection === 'layers'    && <LayersPanel isAdmin={true} />}
                      {activeSection === 'alerts'    && <AlertsPanel />}
                    </ControlPanel>
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
