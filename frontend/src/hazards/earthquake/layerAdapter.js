import { initSimulationLayers, SIM_LAYERS } from '../../config/simulationLayers';
import { mapLayerService } from '../../services/mapLayerService';
import {
  buildEpicenterFeatureCollection,
  initEvacuationLayers,
  syncEvacuationSources,
  syncLiveEarthquakesSource,
} from './mapSources';
import {
  renderSimulationResults,
  restoreSimulationAfterStyleLoad,
  setSimulationHeatmapMode,
} from './simulationMap';
import { EARTHQUAKE_INSPECTION_LAYER_IDS, EARTHQUAKE_LAYERS, EARTHQUAKE_SOURCES } from './layerMetadata';

const EARTHQUAKE_LAYER_IDS = [
  SIM_LAYERS.WB_GRID_FILL,
  SIM_LAYERS.INTENSITY_FILL,
  SIM_LAYERS.CONTOUR_FILL,
  SIM_LAYERS.CONTOUR_STROKE,
  SIM_LAYERS.SHOCKWAVE,
  'sim-epicenter-glow',
  'sim-epicenter-ring',
  SIM_LAYERS.EPICENTER,
  EARTHQUAKE_LAYERS.livePulse,
  EARTHQUAKE_LAYERS.livePoint,
  EARTHQUAKE_LAYERS.evacuationResponderRoute,
  EARTHQUAKE_LAYERS.evacuationHospitalRoute,
  EARTHQUAKE_LAYERS.evacuationOrigin,
  EARTHQUAKE_LAYERS.evacuationTarget,
  EARTHQUAKE_LAYERS.evacuationHospital,
];

const setLayerVisibility = (mapInstance, layerId, visibility) => {
  if (mapInstance?.getLayer(layerId)) {
    mapInstance.setLayoutProperty(layerId, 'visibility', visibility);
  }
};

export const earthquakeLayerAdapter = {
  hazardType: 'earthquake',

  registerLayers(mapInstance) {
    initSimulationLayers(mapInstance);
    initEvacuationLayers(mapInstance);
  },

  syncLayers(mapInstance, store, context = {}) {
    if (!mapInstance?.getStyle()) return;
    if (context.isStyleLoad) {
      restoreSimulationAfterStyleLoad({
        mapInstance,
        store,
        refreshVisibleLegendItems: context.refreshVisibleLegendItems,
      });
    }

    const epicenterSource = mapInstance.getSource('sim-epicenter-source');
    if (epicenterSource) {
      epicenterSource.setData(buildEpicenterFeatureCollection(store.earthquakeEpicenter));
    }
    syncLiveEarthquakesSource(mapInstance, store.liveEvents);
    syncEvacuationSources(mapInstance, {
      origin: store.evacuationOrigin,
      target: store.evacuationTarget,
      plan: store.evacuationPlan,
      autoPlans: store.autoEvacuationPlans,
    });
    renderSimulationResults({
      mapInstance,
      simulationResults: store.simulationResults,
      earthquakeEpicenter: store.earthquakeEpicenter,
      intensityVisible: store.intensityVisible,
      getStoreState: context.getStoreState,
      refreshVisibleLegendItems: context.refreshVisibleLegendItems,
    });
  },

  setVisibility(mapInstance, isActive, store) {
    if (!mapInstance?.getStyle()) return;
    if (!isActive) {
      EARTHQUAKE_LAYER_IDS.forEach((layerId) => setLayerVisibility(mapInstance, layerId, 'none'));
      return;
    }

    const hasResults = Boolean(store.simulationResults);
    setSimulationHeatmapMode(mapInstance, hasResults, store.intensityVisible);
    const epicenterVisibility = store.earthquakeEpicenter ? 'visible' : 'none';
    ['sim-epicenter-glow', 'sim-epicenter-ring', SIM_LAYERS.EPICENTER].forEach((layerId) => {
      setLayerVisibility(mapInstance, layerId, epicenterVisibility);
    });
    [EARTHQUAKE_LAYERS.livePulse, EARTHQUAKE_LAYERS.livePoint].forEach((layerId) => {
      setLayerVisibility(mapInstance, layerId, 'visible');
    });

    const hasAutoPlans = Boolean(store.autoEvacuationPlans?.length);
    const routeVisibility = store.evacuationPlan || hasAutoPlans ? 'visible' : 'none';
    [EARTHQUAKE_LAYERS.evacuationResponderRoute, EARTHQUAKE_LAYERS.evacuationHospitalRoute].forEach((layerId) => {
      setLayerVisibility(mapInstance, layerId, routeVisibility);
    });
    setLayerVisibility(mapInstance, EARTHQUAKE_LAYERS.evacuationOrigin, store.evacuationOrigin ? 'visible' : 'none');
    setLayerVisibility(mapInstance, EARTHQUAKE_LAYERS.evacuationTarget, store.evacuationTarget || hasAutoPlans ? 'visible' : 'none');
    setLayerVisibility(mapInstance, EARTHQUAKE_LAYERS.evacuationHospital, store.evacuationPlan?.hospital_route?.hospital || hasAutoPlans ? 'visible' : 'none');
  },

  bringToFront(mapInstance) {
    mapLayerService.bringSimulationLayersToFront(mapInstance);
    [
      EARTHQUAKE_LAYERS.evacuationResponderRoute,
      EARTHQUAKE_LAYERS.evacuationHospitalRoute,
      EARTHQUAKE_LAYERS.evacuationOrigin,
      EARTHQUAKE_LAYERS.evacuationTarget,
      EARTHQUAKE_LAYERS.evacuationHospital,
    ].forEach((layerId) => {
      if (mapInstance?.getLayer(layerId)) mapInstance.moveLayer(layerId);
    });
  },

  getVisibleLayers(store) {
    const evacuationLayers = [
      ...(store.evacuationPlan || store.autoEvacuationPlans?.length ? [EARTHQUAKE_LAYERS.evacuationHospitalRoute] : []),
      ...(store.evacuationPlan ? [EARTHQUAKE_LAYERS.evacuationResponderRoute] : []),
      ...(store.evacuationOrigin ? [EARTHQUAKE_LAYERS.evacuationOrigin] : []),
      ...(store.evacuationTarget || store.autoEvacuationPlans?.length ? [EARTHQUAKE_LAYERS.evacuationTarget] : []),
      ...(store.evacuationPlan?.hospital_route?.hospital || store.autoEvacuationPlans?.length ? [EARTHQUAKE_LAYERS.evacuationHospital] : []),
    ];
    if (!store.simulationResults) {
      return [EARTHQUAKE_LAYERS.livePulse, EARTHQUAKE_LAYERS.livePoint, ...evacuationLayers];
    }
    const simulationLayers = store.intensityVisible
      ? [SIM_LAYERS.INTENSITY_FILL, SIM_LAYERS.EPICENTER, EARTHQUAKE_LAYERS.livePoint]
      : [SIM_LAYERS.WB_GRID_FILL, SIM_LAYERS.CONTOUR_FILL, SIM_LAYERS.CONTOUR_STROKE, SIM_LAYERS.EPICENTER, EARTHQUAKE_LAYERS.livePoint];
    return [...simulationLayers, ...evacuationLayers];
  },

  getLayerMetadata() {
    return {
      sources: EARTHQUAKE_SOURCES,
      layers: EARTHQUAKE_LAYERS,
      inspectionLayerIds: EARTHQUAKE_INSPECTION_LAYER_IDS,
    };
  },
};
