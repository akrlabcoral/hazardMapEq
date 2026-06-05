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
import useStore from '../store/useStore';
import { useWebSocket } from '../hooks/useWebSocket';

const PANEL_TITLE = {
  layers:    'MAP LAYERS',
  alerts:    'ALERTS',
};

export default function PublicDashboard() {
  const activeSection = useStore((s) => s.activeSection);
  const setActiveSection = useStore((s) => s.setActiveSection);

  // Auto-switch to alerts or layers if disasters was left active in the store
  useEffect(() => {
    if (activeSection === 'disasters') {
      setActiveSection('alerts');
    }
  }, [activeSection, setActiveSection]);

  // Start WebSocket connection — real-time earthquake events + auto-sim results
  useWebSocket();

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Global alert banner for M≥5.0 auto-detected events */}
      <AlertBanner />
      <Navbar />

      <div className="flex-1 relative flex overflow-hidden">
        <Sidebar isAdmin={false} />
        <MapView isAdmin={false} />
        <StateHoverTooltip />
        <MapLegend />
        <StateAnalysisPanel />

        {/* Main Content Overlay */}
        <motion.div
          className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between p-6 pl-[96px]"
          initial={{ left: 0 }}
          animate={{ left: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          {/* Bottom Control Panels */}
          <div className="mt-auto flex gap-4 pointer-events-none items-end [&>*]:pointer-events-auto">
            <AnimatePresence mode="wait">
              {activeSection && PANEL_TITLE[activeSection] && (
                <motion.div
                  key={activeSection}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="w-[480px]"
                >
                  <ControlPanel title={PANEL_TITLE[activeSection]}>
                    {activeSection === 'layers'    && <LayersPanel />}
                    {activeSection === 'alerts'    && <AlertsPanel />}
                  </ControlPanel>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
