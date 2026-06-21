import { SIM_LAYERS } from '../../config/simulationLayers';
import { animationManager } from '../../services/animationManager';
import { mapLayerService } from '../../services/mapLayerService';
import { debugLog } from '../../utils/debug';
import {
  buildEpicenterFeatureCollection,
  syncLiveEarthquakesSource,
} from './mapSources';

const EMPTY_FEATURE_COLLECTION = { type: 'FeatureCollection', features: [] };

export const setSimulationHeatmapMode = (mapInstance, hasResults, showIntensity) => {
  if (!mapInstance?.getStyle()) return;

  const pgaVisibility = hasResults && !showIntensity ? 'visible' : 'none';
  const intensityVisibility = hasResults && showIntensity ? 'visible' : 'none';

  if (mapInstance.getLayer(SIM_LAYERS.CONTOUR_FILL)) {
    mapInstance.setLayoutProperty(SIM_LAYERS.CONTOUR_FILL, 'visibility', pgaVisibility);
  }
  if (mapInstance.getLayer(SIM_LAYERS.CONTOUR_STROKE)) {
    mapInstance.setLayoutProperty(SIM_LAYERS.CONTOUR_STROKE, 'visibility', pgaVisibility);
  }
  if (mapInstance.getLayer(SIM_LAYERS.WB_GRID_FILL)) {
    mapInstance.setLayoutProperty(SIM_LAYERS.WB_GRID_FILL, 'visibility', pgaVisibility);
  }
  if (mapInstance.getLayer(SIM_LAYERS.INTENSITY_FILL)) {
    mapInstance.setLayoutProperty(SIM_LAYERS.INTENSITY_FILL, 'visibility', intensityVisibility);
  }
};

const clearSimulationSources = (mapInstance, sources) => {
  if (sources.wbGridSrc) sources.wbGridSrc.setData(EMPTY_FEATURE_COLLECTION);
  if (sources.contourSrc) sources.contourSrc.setData(EMPTY_FEATURE_COLLECTION);
  if (sources.intensityContourSrc) sources.intensityContourSrc.setData(EMPTY_FEATURE_COLLECTION);
};

export const restoreSimulationAfterStyleLoad = ({
  mapInstance,
  store,
  refreshVisibleLegendItems,
}) => {
  if (!mapInstance?.getStyle()) return;

  const results = store.simulationResults;
  const epicenter = store.earthquakeEpicenter;
  const sources = {
    wbGridSrc: mapInstance.getSource('sim-wb-grid-source'),
    contourSrc: mapInstance.getSource('sim-contour-source'),
    intensityContourSrc: mapInstance.getSource('sim-intensity-contour-source'),
  };
  const epicenterSrc = mapInstance.getSource('sim-epicenter-source');

  if (epicenterSrc) {
    epicenterSrc.setData(buildEpicenterFeatureCollection(epicenter));
  }
  syncLiveEarthquakesSource(mapInstance, store.liveEvents);

  if (!results?.grid_geojson?.type) {
    clearSimulationSources(mapInstance, sources);
    setSimulationHeatmapMode(mapInstance, false, store.intensityVisible);
    animationManager.stopShockwave();
    refreshVisibleLegendItems(mapInstance);
    return;
  }

  if (sources.wbGridSrc) sources.wbGridSrc.setData(results.grid_geojson);
  if (sources.contourSrc) sources.contourSrc.setData(results.contour_geojson || EMPTY_FEATURE_COLLECTION);
  if (sources.intensityContourSrc) {
    sources.intensityContourSrc.setData(results.intensity_contour_geojson || EMPTY_FEATURE_COLLECTION);
  }

  setSimulationHeatmapMode(mapInstance, true, store.intensityVisible);
  mapLayerService.bringSimulationLayersToFront(mapInstance);
  if (epicenter) {
    animationManager.startShockwave(mapInstance, epicenter, 300);
  }
  refreshVisibleLegendItems(mapInstance);
};

export const renderSimulationResults = ({
  mapInstance,
  simulationResults,
  earthquakeEpicenter,
  intensityVisible,
  getStoreState,
  refreshVisibleLegendItems,
}) => {
  try {
    const wbGridSrc = mapInstance.getSource('sim-wb-grid-source');
    const contourSrc = mapInstance.getSource('sim-contour-source');
    const intensityContourSrc = mapInstance.getSource('sim-intensity-contour-source');
    if (!wbGridSrc || !contourSrc) return;

    if (!simulationResults) {
      debugLog('[MapView] simulationResults cleared — hiding layers and clearing data');
      setSimulationHeatmapMode(mapInstance, false, intensityVisible);
      refreshVisibleLegendItems(mapInstance);
      clearSimulationSources(mapInstance, { wbGridSrc, contourSrc, intensityContourSrc });

      if (mapInstance.getSource('state-boundaries-source')) {
        mapInstance.removeFeatureState({ source: 'state-boundaries-source' });
      }

      animationManager.stopShockwave();
      return;
    }

    if (!simulationResults.grid_geojson || !simulationResults.grid_geojson.type) {
      console.warn('[MapView] Invalid grid_geojson received, aborting render.');
      return;
    }

    const currentEpicenter = getStoreState().earthquakeEpicenter;
    debugLog('[MapView] Rendering new simulation results. Current store epicenter:', currentEpicenter);
    debugLog('[MapView] Grid features count:', simulationResults.grid_geojson.features?.length);

    wbGridSrc.setData(simulationResults.grid_geojson);
    if (simulationResults.contour_geojson) {
      contourSrc.setData(simulationResults.contour_geojson);
    }
    if (intensityContourSrc) {
      intensityContourSrc.setData(simulationResults.intensity_contour_geojson || EMPTY_FEATURE_COLLECTION);
    }

    setSimulationHeatmapMode(mapInstance, true, intensityVisible);
    mapLayerService.bringSimulationLayersToFront(mapInstance);
    refreshVisibleLegendItems(mapInstance);
    debugLog('[MapView] Heatmap mode:', intensityVisible ? 'intensity' : 'pga');

    const pendingInfoPanel = getStoreState().pendingSimulationInfoPanel;
    if (pendingInfoPanel) {
      getStoreState().setInfoPanel(pendingInfoPanel);
      getStoreState().clearPendingSimulationInfoPanel();
    }

    if (simulationResults.state_summary) {
      const mapping = getStoreState().stateIdMapping;
      if (mapping) {
        Object.values(simulationResults.state_summary).forEach((summary) => {
          const stateId = mapping[summary.state];
          if (stateId) {
            mapInstance.setFeatureState(
              { source: 'state-boundaries-source', id: stateId },
              {
                avg_pga: summary.avg_pga,
                max_pga: summary.max_pga,
                risk_category: summary.risk_category,
                pop_affected: summary.pop_affected,
                damage_score: summary.damage_score,
              }
            );
          }
        });
      }
    }

    if (earthquakeEpicenter) {
      debugLog('[MapView] Starting shockwave at epicenter:', earthquakeEpicenter);
      animationManager.startShockwave(mapInstance, earthquakeEpicenter, 300);
    }
  } catch (err) {
    console.error('[MapView] Failed to render simulation results:', err);
  }
};

