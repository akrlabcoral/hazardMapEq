// src/pages/Dashboard.jsx
// Main layout shell — composes all panels and map components.
// All business logic has been extracted to dedicated panels and hooks.

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AdminNavbar from '../components/AdminNavbar';
import AdminSidebar from '../components/AdminSidebar';
import MapView from '../components/MapView';
import MapLegend from '../components/MapLegend';
import ControlPanel from '../components/ControlPanel';
import InfoPanel from '../components/InfoPanel';
import UploadProgressManager from '../components/UploadProgressManager';
import AlertBanner from '../components/AlertBanner';
import AdminMapToolbar from '../components/AdminMapToolbar';
import MapLayersControl from '../components/MapLayersControl';
import { DisastersPanel } from '../panels/DisastersPanel';
import { AlertsPanel } from '../panels/AlertsPanel';
import useStore from '../store/useStore';
import { useWebSocket } from '../hooks/useWebSocket';
import LiveEventsPanel from '../panels/LiveEventsPanel';
import HistoricPanel from '../panels/HistoricPanel';
import TsunamiPanel from '../panels/TsunamiPanel';

const PANEL_TITLE = {
  disasters: 'DISASTERS PANEL',
  alerts:    'ALERTS',
  historic_events: 'HISTORIC EVENTS',
  tsunami: 'TSUNAMI ESTIMATE',
};

export default function AdminDashboard() {
  const activeSection = useStore((s) => s.activeSection);

  // Start WebSocket connection — real-time earthquake events + auto-sim results
  useWebSocket();

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Global alert banner for M≥5.0 auto-detected events */}
      <AlertBanner />
      <AdminNavbar />
      <AdminMapToolbar />

      <div className="flex-1 relative flex overflow-hidden">
        <MapView isAdmin={true} />
        <MapLayersControl isAdmin={true} />
        <InfoPanel />
        <MapLegend />
        <UploadProgressManager />

        {/* Left Column Overlay (Sidebar + Panels) */}
        <div className="absolute inset-y-0 left-0 pointer-events-none z-10 flex flex-col w-[480px] max-w-[calc(100vw-1rem)]">
          <div className="pointer-events-auto">
            <AdminSidebar />
          </div>

          <div className="flex-1 pt-0 pb-0 pointer-events-none [&>*]:pointer-events-auto flex flex-col min-h-0">
            <AnimatePresence mode="wait">
              {activeSection && (
                <motion.div
                  key={activeSection}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className={`max-w-full ${activeSection === 'disasters' ? 'w-[480px] h-full flex flex-col min-h-0' : activeSection === 'live_events' || activeSection === 'historic_events' ? 'w-[260px] h-full flex flex-col min-h-0' : 'w-[260px] h-full flex flex-col min-h-0'}`}
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
                    <ControlPanel title={PANEL_TITLE[activeSection] ?? activeSection.toUpperCase()}>
                      {activeSection === 'disasters' && <DisastersPanel />}
                      {activeSection === 'alerts'    && <AlertsPanel />}
                      {activeSection === 'tsunami'   && <TsunamiPanel />}
                    </ControlPanel>
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
