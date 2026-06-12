import React, { useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import useStore from '../store/useStore';
import { mapLayerService } from '../services/mapLayerService';
import { rasterService } from '../services/rasterService';

import { animationManager } from '../services/animationManager';

import { initSimulationLayers, SIM_LAYERS } from '../config/simulationLayers';
import {
  getClusterExpansion,
  getInspectableLayerIds,
  inspectFeature,
  sortInspectionFeatures,
} from '../services/featureInspectionManager';
import { getVisibleLegendItemIds } from '../config/legendConfig';
import { debugLog } from '../utils/debug';

const getStateName = (feature) => feature?.properties?.state || feature?.properties?.STATE || null;
const mapStyleCache = new Map();

const expandCluster = (mapInstance, clusterExpansion) => {
  const source = mapInstance.getSource(clusterExpansion.sourceId);
  if (!source || !clusterExpansion.center) return false;

  const flyToCluster = (zoom) => {
    mapInstance.easeTo({
      center: clusterExpansion.center,
      zoom,
      duration: 500,
    });
  };

  const maybePromise = source.getClusterExpansionZoom(
    clusterExpansion.clusterId,
    (err, zoom) => {
      if (!err && Number.isFinite(zoom)) flyToCluster(zoom);
    }
  );

  if (maybePromise?.then) {
    maybePromise.then(flyToCluster).catch(console.error);
  }

  return true;
};

const inspectMapClick = (mapInstance, event) => {
  const layers = getInspectableLayerIds().filter((layerId) => mapInstance.getLayer(layerId));
  if (!layers.length) return false;

  const features = mapInstance.queryRenderedFeatures(event.point, { layers });
  if (!features.length) {
    useStore.getState().clearInfoPanel();
    return false;
  }

  const feature = sortInspectionFeatures(features)[0];
  const clusterExpansion = getClusterExpansion(feature);
  if (clusterExpansion) {
    useStore.getState().clearInfoPanel();
    return expandCluster(mapInstance, clusterExpansion);
  }

  const infoPanel = inspectFeature(feature, event.lngLat);
  if (!infoPanel) return false;

  useStore.getState().setInfoPanel(infoPanel);
  return true;
};

const bindInspectionCursor = (mapInstance) => {
  getInspectableLayerIds().forEach((layerId) => {
    if (!mapInstance.getLayer(layerId)) return;
    mapInstance.on('mouseenter', layerId, () => {
      mapInstance.getCanvas().style.cursor = 'pointer';
    });
    mapInstance.on('mouseleave', layerId, () => {
      mapInstance.getCanvas().style.cursor = '';
    });
  });
};

const loadMapStyle = async (url) => {
  if (!mapStyleCache.has(url)) {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Map style request failed: ${res.status}`);
    }
    mapStyleCache.set(url, await res.json());
  }
  return structuredClone(mapStyleCache.get(url));
};

const arraysEqual = (a, b) => a.length === b.length && a.every((value, index) => value === b[index]);

const refreshVisibleLegendItems = (mapInstance) => {
  if (!mapInstance?.getStyle()) return;
  const nextItems = getVisibleLegendItemIds(mapInstance);
  const currentItems = useStore.getState().visibleLegendItems || [];
  if (!arraysEqual(nextItems, currentItems)) {
    useStore.getState().setVisibleLegendItems(nextItems);
  }
};

export default function MapView({ isAdmin = false }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const isInitialMount = useRef(true);
  const mapViewport = useStore((state) => state.mapViewport);
  
  const earthquakeEpicenter    = useStore((state) => state.earthquakeEpicenter);
  const setEarthquakeEpicenter = useStore((state) => state.setEarthquakeEpicenter);
  const setIsSimulationRunning = useStore((state) => state.setIsSimulationRunning);
  const selectedStateName      = useStore((state) => state.selectedStateName);
  
  const gisLayers      = useStore((state) => state.gisLayers);
  const soilAmpVisible = useStore((state) => state.soilAmpVisible);
  
  const simulationResults = useStore((state) => state.simulationResults);
  const mapStyle          = useStore((state) => state.mapStyle);
  const isPlacingEpicenter = useStore((state) => state.isPlacingEpicenter);

  // Initialize simulation sources and layers on a loaded map
  const setupSimulation = useCallback((mapInstance) => {
    initSimulationLayers(mapInstance);
  }, []);

  useEffect(() => {
    animationManager.setStoreActions(setIsSimulationRunning);
  }, [setIsSimulationRunning]);

  useEffect(() => {
    if (map.current) return;

    const initialViewport = useStore.getState().mapViewport;
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: { version: 8, sources: {}, layers: [] },
      center: [initialViewport.longitude, initialViewport.latitude],
      zoom: initialViewport.zoom,
      pitch: 0,
      bearing: 0,
      antialias: true
    });

    map.current.once('load', () => {
      map.current.fitBounds([
        [68.7, 8.4],
        [97.25, 37.6]
      ], { padding: 50, duration: 2000 });
    });

    map.current.addControl(new maplibregl.NavigationControl(), 'bottom-right');
    map.current.addControl(new maplibregl.FullscreenControl(), 'top-right');
    map.current.addControl(new maplibregl.ScaleControl(), 'bottom-right');

    const onMapClick = (e) => {
      if (useStore.getState().isPlacingEpicenter) {
        const coords = { lng: e.lngLat.lng, lat: e.lngLat.lat };
        debugLog('[Epicenter] Map click => setting epicenter:', coords);
        setEarthquakeEpicenter(coords);
        useStore.getState().setIsPlacingEpicenter(false);
        return;
      }

      inspectMapClick(map.current, e);
    };
    
    const onMouseDown = (e) => {
      if (!isAdmin) return;
      if (e.originalEvent && e.originalEvent.button === 1) { // Middle mouse button
        e.originalEvent.preventDefault();
        const coords = { lng: e.lngLat.lng, lat: e.lngLat.lat };
        debugLog('[Epicenter] Middle-click => setting epicenter:', coords);
        setEarthquakeEpicenter(coords);
      }
    };
    
    map.current.on('click', onMapClick);
    map.current.on('mousedown', onMouseDown);

    let legendRefreshFrame = null;
    const scheduleLegendRefresh = () => {
      if (legendRefreshFrame !== null) return;
      legendRefreshFrame = requestAnimationFrame(() => {
        legendRefreshFrame = null;
        refreshVisibleLegendItems(map.current);
      });
    };
    const legendEvents = ['idle', 'moveend', 'zoomend', 'styledata', 'sourcedata'];
    legendEvents.forEach((eventName) => map.current.on(eventName, scheduleLegendRefresh));

    let isMapEventsInitialized = false;

    map.current.on('style.load', () => {
      setupSimulation(map.current);
      mapLayerService.initializeSourcesAndLayers(map.current, useStore.getState().gisLayers);
      rasterService.setMap(map.current);
      scheduleLegendRefresh();

      if (!isAdmin) {
        const popLayer = useStore.getState().rasterLayers.find(l => l.id === 'population-exposure');
        if (popLayer && !popLayer.visible && !popLayer.isLoaded) {
          useStore.getState().updateRasterLayerVisibility('population-exposure', true);
          rasterService.addGeoTiffFromUrl(popLayer.url, popLayer.id, {
            opacity: popLayer.opacity,
            visible: true,
            renderingModeOverride: 'population'
          }).then(() => {
            useStore.getState().updateRasterLayerLoaded(popLayer.id, true);
          }).catch(console.error);
        }
      }

      if (!isMapEventsInitialized) {
        isMapEventsInitialized = true;
        
        fetch('/data/india_states.geojson')
          .then(res => res.json())
          .then(data => {
            const mapping = {};
            data.features.forEach(f => {
              const stateName = getStateName(f);
              const stateId = f.properties.id ?? f.id;
              if (stateName && stateId !== undefined) {
                mapping[stateName] = stateId;
              }
            });
            useStore.getState().setStateIdMapping(mapping);
          });

        bindInspectionCursor(map.current);

        let hoveredStateId = null;
        map.current.on('mousemove', 'state-boundaries-fill', (e) => {
          if (e.features.length > 0) {
            const feature = e.features[0];
            if (hoveredStateId !== null) {
              map.current.setFeatureState(
                { source: 'state-boundaries-source', id: hoveredStateId },
                { hover: false }
              );
            }
            hoveredStateId = feature.properties.id ?? feature.id;
            map.current.setFeatureState(
              { source: 'state-boundaries-source', id: hoveredStateId },
              { hover: true }
            );
          }
        });

        map.current.on('mouseleave', 'state-boundaries-fill', () => {
          if (hoveredStateId !== null) {
            map.current.setFeatureState(
              { source: 'state-boundaries-source', id: hoveredStateId },
              { hover: false }
            );
          }
          hoveredStateId = null;
        });

        let hoveredPlateId = null;
        map.current.on('mousemove', 'tectonic-plates-line', (e) => {
          if (e.features.length > 0) {
            const feature = e.features[0];
            
            if (hoveredPlateId !== null) {
              map.current.setFeatureState(
                { source: 'tectonic-plates-source', id: hoveredPlateId },
                { hover: false }
              );
            }
            // Fallback to OBJECTID if id is missing
            hoveredPlateId = feature.id || feature.properties.OBJECTID;
            if (hoveredPlateId !== undefined) {
              map.current.setFeatureState(
                { source: 'tectonic-plates-source', id: hoveredPlateId },
                { hover: true }
              );
            }
          }
        });

        map.current.on('mouseleave', 'tectonic-plates-line', () => {
          if (hoveredPlateId !== null) {
            map.current.setFeatureState(
              { source: 'tectonic-plates-source', id: hoveredPlateId },
              { hover: false }
            );
            hoveredPlateId = null;
          }
        });
      }
    });

    return () => {
      animationManager.stopShockwave();
      if (legendRefreshFrame !== null) {
        cancelAnimationFrame(legendRefreshFrame);
      }
      if (map.current) {
        legendEvents.forEach((eventName) => map.current.off(eventName, scheduleLegendRefresh));
        map.current.off('click', onMapClick);
        map.current.off('mousedown', onMouseDown);
        map.current.remove();
        map.current = null;
      }
      useStore.getState().setVisibleLegendItems([]);
    };
  }, [setEarthquakeEpicenter, setupSimulation, isAdmin]);

  // Fly to new viewport when it changes
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (map.current && mapViewport) {
      map.current.flyTo({
        center: [mapViewport.longitude, mapViewport.latitude],
        zoom: mapViewport.zoom,
        essential: true,
        duration: 1000
      });
    }
  }, [mapViewport]);

  // Sync Map Theme (Dark/Light) using vector styles to color the oceans light blue
  useEffect(() => {
    if (!map.current) return;
    const applyStyle = async () => {
      try {
        const url = mapStyle === 'dark' 
          ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
          : 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
        const styleJson = await loadMapStyle(url);
        
        // Find the water layer and mutate its color to light blue
        const waterLayer = styleJson.layers.find(l => l.id === 'water');
        if (waterLayer) {
          waterLayer.paint['fill-color'] = '#B1D8E6'; // Light blue ocean
        }

        // Setting a new style wipes out custom layers. 
        // We must tell mapLayerService to re-initialize on the next style.load
        mapLayerService.initialized = false;
        
        map.current.setStyle(styleJson);
      } catch (err) {
        console.error("Failed to load map style:", err);
      }
    };
    applyStyle();
  }, [mapStyle]);

  // Sync GIS layer visibility
  useEffect(() => {
    if (!mapLayerService.initialized) return;
    Object.keys(gisLayers).forEach(layerKey => {
      mapLayerService.setLayerVisibility(layerKey, gisLayers[layerKey]);
    });
    refreshVisibleLegendItems(map.current);
  }, [gisLayers]);

  // Update epicenter marker
  useEffect(() => {
    if (!map.current || !map.current.getStyle()) return;
    const source = map.current.getSource('sim-epicenter-source');
    if (!source) return;

    if (!earthquakeEpicenter) {
      source.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    source.setData({
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [earthquakeEpicenter.lng, earthquakeEpicenter.lat] }
      }]
    });
  }, [earthquakeEpicenter]);

  // Sync Soil Amplification layer visibility
  useEffect(() => {
    if (!map.current || !map.current.getStyle()) return;
    if (mapLayerService.layerExists(map.current, SIM_LAYERS.SOIL_AMP)) {
      map.current.setLayoutProperty(
        SIM_LAYERS.SOIL_AMP, 
        'visibility', 
        soilAmpVisible ? 'visible' : 'none'
      );
    }
    refreshVisibleLegendItems(map.current);
  }, [soilAmpVisible]);

  // Sync state isolation filter
  useEffect(() => {
    if (!map.current || !map.current.getStyle()) return;
    const filter = selectedStateName ? ['==', ['get', 'state'], selectedStateName] : null;
    
    if (mapLayerService.layerExists(map.current, SIM_LAYERS.WB_GRID_FILL)) {
      map.current.setFilter(SIM_LAYERS.WB_GRID_FILL, filter);
    }
    if (mapLayerService.layerExists(map.current, SIM_LAYERS.CONTOUR_FILL)) {
      map.current.setFilter(SIM_LAYERS.CONTOUR_FILL, filter);
    }
    refreshVisibleLegendItems(map.current);
  }, [selectedStateName]);

  // Render simulation results and trigger shockwave
  useEffect(() => {
    if (!map.current) return;
    let styleWaitInterval = null;

    const updateSimulationResults = () => {
      try {
        const wbGridSrc = map.current.getSource('sim-wb-grid-source');
        const contourSrc = map.current.getSource('sim-contour-source');
        if (!wbGridSrc || !contourSrc) return;

        if (!simulationResults) {
          // simulationResults=null means simulation was just triggered or cleared
          debugLog('[MapView] simulationResults cleared — hiding layers and clearing data');
          if (map.current.getLayer(SIM_LAYERS.CONTOUR_FILL))   map.current.setLayoutProperty(SIM_LAYERS.CONTOUR_FILL,   'visibility', 'none');
          if (map.current.getLayer(SIM_LAYERS.CONTOUR_STROKE)) map.current.setLayoutProperty(SIM_LAYERS.CONTOUR_STROKE, 'visibility', 'none');
          if (map.current.getLayer(SIM_LAYERS.WB_GRID_FILL))   map.current.setLayoutProperty(SIM_LAYERS.WB_GRID_FILL,   'visibility', 'none');
          refreshVisibleLegendItems(map.current);
          
          const emptyFC = { type: 'FeatureCollection', features: [] };
          if (wbGridSrc) wbGridSrc.setData(emptyFC);
          if (contourSrc) contourSrc.setData(emptyFC);

          if (map.current.getSource('state-boundaries-source')) {
            map.current.removeFeatureState({ source: 'state-boundaries-source' });
          }

          animationManager.stopShockwave();
          return;
        }

        if (!simulationResults.grid_geojson || !simulationResults.grid_geojson.type) {
          console.warn('[MapView] Invalid grid_geojson received, aborting render.');
          return;
        }

        // Log the epicenter the backend used (embedded in features) vs current store
        const currentEpicenter = useStore.getState().earthquakeEpicenter;
        debugLog('[MapView] Rendering new simulation results. Current store epicenter:', currentEpicenter);
        debugLog('[MapView] Grid features count:', simulationResults.grid_geojson.features?.length);

        wbGridSrc.setData(simulationResults.grid_geojson);
        if (simulationResults.contour_geojson) {
          contourSrc.setData(simulationResults.contour_geojson);
        }
        
        if (map.current.getLayer(SIM_LAYERS.CONTOUR_FILL))   map.current.setLayoutProperty(SIM_LAYERS.CONTOUR_FILL,   'visibility', 'visible');
        if (map.current.getLayer(SIM_LAYERS.CONTOUR_STROKE)) map.current.setLayoutProperty(SIM_LAYERS.CONTOUR_STROKE, 'visibility', 'visible');
        if (map.current.getLayer(SIM_LAYERS.WB_GRID_FILL))   map.current.setLayoutProperty(SIM_LAYERS.WB_GRID_FILL,   'visibility', 'visible');
        mapLayerService.bringSimulationLayersToFront(map.current);
        refreshVisibleLegendItems(map.current);
        debugLog('[MapView] Layers made visible:', SIM_LAYERS.CONTOUR_FILL, SIM_LAYERS.CONTOUR_STROKE, SIM_LAYERS.WB_GRID_FILL);

        if (simulationResults.state_summary) {
          const mapping = useStore.getState().stateIdMapping;
          if (mapping) {
            Object.values(simulationResults.state_summary).forEach(summary => {
              const stateId = mapping[summary.state];
              if (stateId) {
                map.current.setFeatureState(
                  { source: 'state-boundaries-source', id: stateId },
                  { 
                    avg_pga: summary.avg_pga,
                    max_pga: summary.max_pga,
                    risk_category: summary.risk_category,
                    pop_affected: summary.pop_affected,
                    damage_score: summary.damage_score
                  }
                );
              }
            });
          }
        }

        if (earthquakeEpicenter) {
          debugLog('[MapView] Starting shockwave at epicenter:', earthquakeEpicenter);
          animationManager.startShockwave(map.current, earthquakeEpicenter, 300);
        }
      } catch (err) {
        console.error('[MapView] Failed to render simulation results:', err);
      }
    };

    // Wait for style to be fully loaded before updating.
    // Previous approach used once('styledata') which silently failed when the
    // event had already fired, causing the heatmap to require two clicks.
    const waitForStyleAndUpdate = () => {
      if (map.current.isStyleLoaded()) {
        updateSimulationResults();
      } else {
        // Poll every 50ms until the style finishes processing (max 2s safety)
        let attempts = 0;
        styleWaitInterval = setInterval(() => {
          attempts++;
          if (map.current && map.current.isStyleLoaded()) {
            clearInterval(styleWaitInterval);
            styleWaitInterval = null;
            updateSimulationResults();
          } else if (attempts > 40) {
            clearInterval(styleWaitInterval);
            styleWaitInterval = null;
            console.warn('[MapView] Style never loaded after 2s, forcing update.');
            updateSimulationResults();
          }
        }, 50);
      }
    };

    waitForStyleAndUpdate();
    return () => {
      if (styleWaitInterval) {
        clearInterval(styleWaitInterval);
      }
    };
  }, [simulationResults, earthquakeEpicenter]);

  return (
    <div className="absolute inset-0 z-0">
      <div ref={mapContainer} className={`w-full h-full ${isPlacingEpicenter ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`} />
      {/* Cinematic vignette overlay */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-slate-950/30 to-slate-950/90 mix-blend-multiply" />
    </div>
  );
}
