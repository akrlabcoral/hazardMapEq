import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PublicNavbar from '../components/PublicNavbar';
import PublicSidebar from '../components/PublicSidebar';
import MapView from '../components/MapView';
import MapLegend from '../components/MapLegend';
import ControlPanel from '../components/ControlPanel';
import InfoPanel from '../components/InfoPanel';
import AlertBanner from '../components/AlertBanner';
import PublicMapToolbar from '../components/PublicMapToolbar';
import MapLayersControl from '../components/MapLayersControl';
import { getDefaultSection, getHazardPanel, getHazardPanelIds } from '../hazards/registry';
import useStore from '../store/useStore';
import { useWebSocket } from '../hooks/useWebSocket';

export default function PublicDashboard() {
  const activePanel = useStore((s) => s.activePanel);
  const activeHazard = useStore((s) => s.activeHazard);
  const forceActivePanel = useStore((s) => s.forceActivePanel);
  const panelMeta = getHazardPanel(activeHazard, activePanel, 'public');

  useEffect(() => {
    const { activePanel: current, activeHazard: hazard } = useStore.getState();
    const validSections = getHazardPanelIds(hazard, 'public');
    if (!current || current === 'workflow' || current === 'layers' || !validSections.includes(current)) {
      forceActivePanel(getDefaultSection(hazard, 'public') || validSections[0] || null);
    }
    useStore.setState((state) => ({
      gisLayers: {
        ...state.gisLayers,
        satellite: true,
        gpsVectors: true,
      },
    }));
  }, [activeHazard, forceActivePanel]);

  // Start WebSocket connection — real-time earthquake events + auto-sim results
  useWebSocket();

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Global alert banner for M≥5.0 auto-detected events */}
      <AlertBanner />
      <PublicNavbar />
      <PublicMapToolbar />

      <div className="flex-1 relative flex overflow-hidden">
        <MapView isAdmin={false} />
        <MapLayersControl isAdmin={false} />
        <InfoPanel />
        <MapLegend />

        {/* Left Column Overlay (Sidebar + Panels) */}
        <div className="absolute inset-y-0 left-0 pointer-events-none z-10 flex flex-col w-[260px] max-w-[calc(100vw-1rem)]">
          <div className="pointer-events-auto">
            <PublicSidebar />
          </div>

          <div className="flex-1 pt-0 pb-0 pointer-events-none [&>*]:pointer-events-auto flex flex-col min-h-0">
            <AnimatePresence mode="wait">
              {activePanel && (
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
      </div>
    </div>
  );
}
