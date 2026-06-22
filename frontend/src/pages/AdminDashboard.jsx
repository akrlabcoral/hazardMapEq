// src/pages/Dashboard.jsx
// Main layout shell — composes all panels and map components.
// All business logic has been extracted to dedicated panels and hooks.

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
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
import HazardWorkflowDock from '../components/hazards/HazardWorkflowDock';
import { getBottomDockPanelIds, getHazardPanel } from '../hazards/registry';
import useStore from '../store/useStore';
import { useWebSocket } from '../hooks/useWebSocket';

const BOTTOM_DOCK_SECTIONS = getBottomDockPanelIds('admin');

export default function AdminDashboard() {
  const activePanel = useStore((s) => s.activePanel);
  const activeHazard = useStore((s) => s.activeHazard);
  const forceActivePanel = useStore((s) => s.forceActivePanel);
  const panelMeta = getHazardPanel(activeHazard, activePanel, 'admin');

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
        <div className="absolute inset-y-0 left-0 pointer-events-none z-10 flex flex-col w-[260px] max-w-[calc(100vw-1rem)]">
          <div className="pointer-events-auto">
            <AdminSidebar />
          </div>

          <div className="flex-1 pt-0 pb-0 pointer-events-none [&>*]:pointer-events-auto flex flex-col min-h-0">
            <AnimatePresence mode="wait">
              {activePanel && !BOTTOM_DOCK_SECTIONS.has(activePanel) && (
                <motion.div
                  key={activePanel}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="w-[260px] max-w-full h-full flex flex-col min-h-0"
                >
                  {panelMeta?.panelShell === false ? (
                    <div className="min-h-0 flex-1">
                      {panelMeta.render?.()}
                    </div>
                  ) : (
                    panelMeta?.title && (
                      <ControlPanel title={panelMeta.title}>
                        {panelMeta.render?.()}
                      </ControlPanel>
                    )
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {BOTTOM_DOCK_SECTIONS.has(activePanel) && (
          <HazardWorkflowDock onClose={() => forceActivePanel(null)} />
        )}
      </div>
    </div>
  );
}
