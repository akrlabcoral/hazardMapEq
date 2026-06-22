import React from 'react';
import { Activity, AlertTriangle, Archive, Play, Radio } from 'lucide-react';

import { earthquakeInspectionProvider } from './inspectionProvider';
import { earthquakeLayerAdapter } from './layerAdapter';
import { EARTHQUAKE_LEGEND_ITEMS } from './legendItems';
import { EARTHQUAKE_INSPECTION_LAYER_IDS, EARTHQUAKE_LAYERS, EARTHQUAKE_SOURCES } from './layerMetadata';
import * as earthquakeMapSources from './mapSources';
import { createSimulationSlice } from './state';
import EarthquakeWorkflowDock, { useEarthquakeWorkflowDockLayout } from './workflowDock.jsx';
import { AlertsPanel } from '../../panels/AlertsPanel';
import HistoricPanel from '../../panels/HistoricPanel';
import LiveEventsPanel from '../../panels/LiveEventsPanel';

export * from './infoPanels';
export * from './inspectionProvider';
export * from './layerAdapter';
export * from './legendItems';
export * from './layerMetadata';
export * from './mapSources';
export * from './simulationMap';
export * from './state';
export * from './useEarthquakeState';
export * from './useSimulation';
export * from './workflowDock';
export * from './panels/DisastersPanel';

const earthquakeHazard = {
  id: 'earthquake',
  label: 'Earthquake',
  icon: Activity,
  order: 10,
  defaultSection: { admin: 'workflow', public: 'live_events' },
  layerMetadata: {
    sources: EARTHQUAKE_SOURCES,
    layers: EARTHQUAKE_LAYERS,
    inspectionLayerIds: EARTHQUAKE_INSPECTION_LAYER_IDS,
  },
  legendItems: EARTHQUAKE_LEGEND_ITEMS,
  panels: [
    {
      id: 'alerts',
      icon: AlertTriangle,
      label: 'Alerts',
      title: 'ALERTS',
      modes: ['admin', 'public'],
      placement: 'sidePanel',
      render: () => React.createElement(AlertsPanel),
    },
    {
      id: 'live_events',
      icon: Radio,
      label: 'Live Events',
      title: 'LIVE EVENTS',
      modes: ['admin', 'public'],
      placement: 'sidePanel',
      component: 'liveEvents',
      panelShell: false,
      render: () => React.createElement(LiveEventsPanel),
    },
    {
      id: 'historic',
      icon: Archive,
      label: 'Historic Earthquakes',
      title: 'HISTORIC EARTHQUAKES',
      modes: ['admin', 'public'],
      placement: 'sidePanel',
      component: 'historic',
      panelShell: false,
      render: () => React.createElement(HistoricPanel),
    },
  ],
  mapSources: earthquakeMapSources,
  layerAdapter: earthquakeLayerAdapter,
  state: createSimulationSlice,
  inspectionProvider: earthquakeInspectionProvider,
  workflowDock: {
    id: 'workflow',
    icon: Play,
    label: 'Earthquake Simulation',
    title: 'DISASTERS PANEL',
    modes: ['admin'],
    placement: 'bottomDock',
    useLayout: useEarthquakeWorkflowDockLayout,
    Component: EarthquakeWorkflowDock,
  },
};

export default earthquakeHazard;
