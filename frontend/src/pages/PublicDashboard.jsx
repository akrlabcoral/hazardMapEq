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
import { AlertsPanel } from '../panels/AlertsPanel';
import useStore from '../store/useStore';
import { useWebSocket } from '../hooks/useWebSocket';
import LiveEventsPanel from '../panels/LiveEventsPanel';
import HistoricPanel from '../panels/HistoricPanel';
import TsunamiPanel from '../panels/TsunamiPanel';
import LandslidePanel from '../panels/LandslidePanel';
import OtherHazardsPanel from '../panels/OtherHazardsPanel';

const PANEL_TITLE = {
  alerts: 'ALERTS',
  tsunami: 'TSUNAMI ESTIMATE',
  landslide: 'LANDSLIDE',
  other_hazards: 'MORE HAZARDS',
};

const DEFAULT_PUBLIC_SECTION_BY_HAZARD = {
  earthquake: 'live_events',
  tsunami: 'tsunami',
  landslide: 'landslide',
  other: 'other_hazards',
};

const PUBLIC_SECTIONS_BY_HAZARD = {
  earthquake: ['alerts', 'live_events', 'historic_events'],
  tsunami: ['tsunami'],
  landslide: ['landslide'],
  other: ['other_hazards'],
};

export default function PublicDashboard() {
  const activeSection = useStore((s) => s.activeSection);
  const activeHazard = useStore((s) => s.activeHazard);
  const forceActiveSection = useStore((s) => s.forceActiveSection);

  useEffect(() => {
    const { activeSection: current, activeHazard: hazard } = useStore.getState();
    const validSections = PUBLIC_SECTIONS_BY_HAZARD[hazard] || PUBLIC_SECTIONS_BY_HAZARD.earthquake;
    if (!current || current === 'disasters' || current === 'layers' || !validSections.includes(current)) {
      forceActiveSection(DEFAULT_PUBLIC_SECTION_BY_HAZARD[hazard] || 'live_events');
    }
    useStore.setState((state) => ({
      gisLayers: {
        ...state.gisLayers,
        satellite: true,
        gpsVectors: true,
      },
    }));
  }, [activeHazard, forceActiveSection]);

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
              {activeSection && (
                <motion.div
                  key={activeSection}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="w-[260px] max-w-full h-full flex flex-col min-h-0"
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
                        {activeSection === 'tsunami' && <TsunamiPanel />}
                        {activeSection === 'landslide' && <LandslidePanel />}
                        {activeSection === 'other_hazards' && <OtherHazardsPanel />}
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
