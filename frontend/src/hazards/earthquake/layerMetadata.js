import { LIVE_EARTHQUAKE_LAYERS, LIVE_EARTHQUAKE_SOURCE, SIM_LAYERS } from '../../config/simulationLayers';

export const EARTHQUAKE_SOURCES = {
  historic: 'historic-earthquakes-source',
  live: LIVE_EARTHQUAKE_SOURCE,
  evacuationRoutes: 'earthquake-evacuation-routes-source',
  evacuationPoints: 'earthquake-evacuation-points-source',
};

export const EARTHQUAKE_LAYERS = {
  historicClusters: 'historic-clusters',
  historicClusterCount: 'historic-cluster-count',
  historicPoint: 'historic-unclustered-point',
  livePulse: LIVE_EARTHQUAKE_LAYERS.PULSE,
  livePoint: LIVE_EARTHQUAKE_LAYERS.POINT,
  legacyLivePointIds: ['live-earthquakes-point', 'live-event-point', 'live-events-point'],
  pgaFill: SIM_LAYERS.CONTOUR_FILL,
  gridFill: SIM_LAYERS.WB_GRID_FILL,
  intensityFill: SIM_LAYERS.INTENSITY_FILL,
  epicenter: SIM_LAYERS.EPICENTER,
  evacuationResponderRoute: 'earthquake-evacuation-responder-route',
  evacuationHospitalRoute: 'earthquake-evacuation-hospital-route',
  evacuationOrigin: 'earthquake-evacuation-origin',
  evacuationTarget: 'earthquake-evacuation-target',
  evacuationHospital: 'earthquake-evacuation-hospital',
};

export const EARTHQUAKE_INSPECTION_LAYER_IDS = [
  EARTHQUAKE_LAYERS.historicClusters,
  EARTHQUAKE_LAYERS.historicClusterCount,
  EARTHQUAKE_LAYERS.livePoint,
  ...EARTHQUAKE_LAYERS.legacyLivePointIds,
  EARTHQUAKE_LAYERS.historicPoint,
];
