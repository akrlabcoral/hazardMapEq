import React from 'react';
import { AlertTriangle, Archive, Play, Radio, Waves } from 'lucide-react';

import { tsunamiInspectionProvider } from './inspectionProvider';
import { tsunamiLayerAdapter } from './layerAdapter';
import { TSUNAMI_LEGEND_ITEMS } from './legendItems';
import { TSUNAMI_LAYERS, TSUNAMI_SOURCES } from './layerMetadata';
import * as tsunamiApi from './api';
import * as tsunamiMapSources from './mapSources';
import { createTsunamiSlice } from './state';
import TsunamiEmptyPanel from './panels/TsunamiEmptyPanel';
import TsunamiAlertsPanel from './panels/TsunamiAlertsPanel';
import TsunamiHistoryPanel from './panels/TsunamiHistoryPanel';
import TsunamiWorkflowDock, { useTsunamiWorkflowDockLayout } from './workflowDock';

export * from './api';
export * from './infoPanels';
export * from './inspectionProvider';
export * from './layerAdapter';
export * from './layerMetadata';
export * from './legendItems';
export * from './mapSources';
export * from './state';
export * from './workflowDock';
export { default as TsunamiEmptyPanel } from './panels/TsunamiEmptyPanel';
export { default as TsunamiAlertsPanel } from './panels/TsunamiAlertsPanel';
export { default as TsunamiHistoryPanel } from './panels/TsunamiHistoryPanel';

const tsunamiHazard = {
  id: 'tsunami',
  label: 'Tsunami',
  icon: Waves,
  order: 20,
  defaultSection: { admin: 'workflow', public: 'alerts' },
  layerMetadata: {
    sources: TSUNAMI_SOURCES,
    layers: TSUNAMI_LAYERS,
  },
  legendItems: TSUNAMI_LEGEND_ITEMS,
  panels: [
    {
      id: 'alerts',
      icon: AlertTriangle,
      label: 'Tsunami Alerts',
      title: 'TSUNAMI ALERTS',
      modes: ['admin', 'public'],
      placement: 'sidePanel',
      component: 'alerts',
      render: () => React.createElement(TsunamiAlertsPanel),
    },
    {
      id: 'live_events',
      icon: Radio,
      label: 'Live Tsunami Events',
      title: 'LIVE TSUNAMI EVENTS',
      modes: ['admin', 'public'],
      placement: 'sidePanel',
      component: 'tsunamiLiveEvents',
      render: () => React.createElement(TsunamiEmptyPanel, { type: 'live' }),
    },
    {
      id: 'historic',
      icon: Archive,
      label: 'Historic Tsunami',
      title: 'HISTORIC TSUNAMI',
      modes: ['admin', 'public'],
      placement: 'sidePanel',
      component: 'historic',
      render: () => React.createElement(TsunamiHistoryPanel),
    },
  ],
  mapSources: tsunamiMapSources,
  layerAdapter: tsunamiLayerAdapter,
  state: createTsunamiSlice,
  inspectionProvider: tsunamiInspectionProvider,
  analysisApi: tsunamiApi,
  workflowDock: {
    id: 'workflow',
    icon: Play,
    label: 'Tsunami Simulation',
    title: 'TSUNAMI SIMULATION',
    modes: ['admin'],
    placement: 'bottomDock',
    useLayout: useTsunamiWorkflowDockLayout,
    Component: TsunamiWorkflowDock,
  },
};

export default tsunamiHazard;
