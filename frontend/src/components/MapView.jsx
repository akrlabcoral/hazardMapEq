import React, { useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import { Home, ZoomIn, ZoomOut } from 'lucide-react';
import useStore from '../store/useStore';
import { mapLayerService } from '../services/mapLayerService';
import { rasterService } from '../services/rasterService';

import { animationManager } from '../services/animationManager';

import {
  initSimulationLayers,
  LIVE_EARTHQUAKE_SOURCE,
  SIM_LAYERS,
} from '../config/simulationLayers';
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
const DEFAULT_MAP_BOUNDS = [
  [50.7, 8.4],
  [97.25, 37.6]
];
const DEFAULT_MAP_FIT_OPTIONS = { padding: 50, duration: 800 };

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

const getMapCursor = ({ isPlacingEpicenter, isSimulationRunning, isInspectableHover = false }) => {
  if (isPlacingEpicenter) return 'crosshair';
  if (isSimulationRunning) return 'wait';
  if (isInspectableHover) return 'pointer';
  return '';
};

const applyMapCursor = (mapInstance, overrides = {}) => {
  const canvas = mapInstance?.getCanvas?.();
  if (!canvas) return;
  const store = useStore.getState();
  canvas.style.cursor = getMapCursor({ ...store, ...overrides });
};

const bindInspectionCursor = (mapInstance) => {
  getInspectableLayerIds().forEach((layerId) => {
    if (!mapInstance.getLayer(layerId)) return;
    mapInstance.on('mouseenter', layerId, () => {
      applyMapCursor(mapInstance, { isInspectableHover: true });
    });
    mapInstance.on('mouseleave', layerId, () => {
      applyMapCursor(mapInstance);
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

const applyBoundaryTheme = (mapInstance, mapStyle) => {
  if (!mapInstance?.getStyle()) return;
  const isDark = mapStyle === 'dark';
  const boundaryLine = isDark ? '#22d3ee' : '#000000';
  const boundaryFill = isDark ? '#0891b2' : '#0f172a';
  const stateHoverFill = isDark ? '#22d3ee' : '#0ea5e9';

  if (mapInstance.getLayer('india-boundary-fill')) {
    mapInstance.setPaintProperty('india-boundary-fill', 'fill-color', boundaryFill);
  }
  if (mapInstance.getLayer('india-boundary-line')) {
    mapInstance.setPaintProperty('india-boundary-line', 'line-color', boundaryLine);
  }
  if (mapInstance.getLayer('state-boundaries-fill')) {
    mapInstance.setPaintProperty('state-boundaries-fill', 'fill-color', stateHoverFill);
  }
  if (mapInstance.getLayer('state-boundaries-line')) {
    mapInstance.setPaintProperty('state-boundaries-line', 'line-color', [
      'case',
      ['boolean', ['feature-state', 'hover'], false],
      boundaryLine,
      boundaryLine,
    ]);
  }
};

const buildEpicenterFeatureCollection = (epicenter) => ({
  type: 'FeatureCollection',
  features: epicenter ? [{
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [epicenter.lng, epicenter.lat] }
  }] : []
});

const asFiniteNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const buildLiveEventsFeatureCollection = (events = []) => ({
  type: 'FeatureCollection',
  features: events
    .map((event, index) => {
      const longitude = asFiniteNumber(event.longitude ?? event.lon ?? event.lng);
      const latitude = asFiniteNumber(event.latitude ?? event.lat);
      if (longitude === null || latitude === null) return null;

      const magnitude = asFiniteNumber(event.magnitude ?? event.mag) ?? 0;
      const depth = asFiniteNumber(event.depth ?? event.depth_km);
      const place = event.place || event.location || 'Live earthquake';
      const time = event.time || event.origin_time || event.created_at || null;

      return {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [longitude, latitude],
        },
        properties: {
          id: event.id ?? index,
          source_id: event.source_id || '',
          source: event.source || '',
          magnitude,
          mag: magnitude,
          depth,
          depth_km: depth,
          place,
          location: place,
          time,
          is_relevant: Boolean(event.is_relevant),
        },
      };
    })
    .filter(Boolean),
});

const syncLiveEarthquakesSource = (mapInstance, events) => {
  if (!mapInstance?.getStyle()) return;
  const source = mapInstance.getSource(LIVE_EARTHQUAKE_SOURCE);
  if (source?.setData) {
    source.setData(buildLiveEventsFeatureCollection(events));
  }
};

const setSimulationHeatmapMode = (mapInstance, hasResults, showIntensity) => {
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

const restoreSimulationAfterStyleLoad = (mapInstance) => {
  if (!mapInstance?.getStyle()) return;

  const store = useStore.getState();
  const results = store.simulationResults;
  const epicenter = store.earthquakeEpicenter;
  const wbGridSrc = mapInstance.getSource('sim-wb-grid-source');
  const contourSrc = mapInstance.getSource('sim-contour-source');
  const intensityContourSrc = mapInstance.getSource('sim-intensity-contour-source');
  const epicenterSrc = mapInstance.getSource('sim-epicenter-source');
  const emptyFC = { type: 'FeatureCollection', features: [] };

  if (epicenterSrc) {
    epicenterSrc.setData(buildEpicenterFeatureCollection(epicenter));
  }
  syncLiveEarthquakesSource(mapInstance, store.liveEvents);

  if (!results?.grid_geojson?.type) {
    if (wbGridSrc) wbGridSrc.setData(emptyFC);
    if (contourSrc) contourSrc.setData(emptyFC);
    if (intensityContourSrc) intensityContourSrc.setData(emptyFC);
    setSimulationHeatmapMode(mapInstance, false, store.intensityVisible);
    animationManager.stopShockwave();
    refreshVisibleLegendItems(mapInstance);
    return;
  }

  if (wbGridSrc) wbGridSrc.setData(results.grid_geojson);
  if (contourSrc) contourSrc.setData(results.contour_geojson || emptyFC);
  if (intensityContourSrc) intensityContourSrc.setData(results.intensity_contour_geojson || emptyFC);

  setSimulationHeatmapMode(mapInstance, true, store.intensityVisible);

  mapLayerService.bringSimulationLayersToFront(mapInstance);
  if (epicenter) {
    animationManager.startShockwave(mapInstance, epicenter, 300);
  }
  refreshVisibleLegendItems(mapInstance);
};

const restoreTsunamiWaveAfterStyleLoad = (mapInstance) => {
  if (!mapInstance?.getStyle()) return;
  const warningEvent = useStore.getState().activeTsunamiWarning;
  if (warningEvent?.tsunami_warning?.is_warning) {
    animationManager.startTsunamiWave(mapInstance, warningEvent);
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
  
  const gisLayers      = useStore((state) => state.gisLayers);
  const intensityVisible = useStore((state) => state.intensityVisible);
  
  const simulationResults = useStore((state) => state.simulationResults);
  const pendingSimulationInfoPanel = useStore((state) => state.pendingSimulationInfoPanel);
  const mapStyle          = useStore((state) => state.mapStyle);
  const isPlacingEpicenter = useStore((state) => state.isPlacingEpicenter);
  const isSimulationRunning = useStore((state) => state.isSimulationRunning);
  const liveEvents = useStore((state) => state.liveEvents);
  const activeTsunamiWarning = useStore((state) => state.activeTsunamiWarning);

  // Initialize simulation sources and layers on a loaded map
  const setupSimulation = useCallback((mapInstance) => {
    initSimulationLayers(mapInstance);
  }, []);

  useEffect(() => {
    animationManager.setStoreActions(setIsSimulationRunning);
  }, [setIsSimulationRunning]);

  const zoomIn = useCallback(() => {
    map.current?.zoomIn({ duration: 300 });
  }, []);

  const zoomOut = useCallback(() => {
    map.current?.zoomOut({ duration: 300 });
  }, []);

  const resetMapView = useCallback(() => {
    map.current?.fitBounds(DEFAULT_MAP_BOUNDS, DEFAULT_MAP_FIT_OPTIONS);
  }, []);

  useEffect(() => {
    applyMapCursor(map.current);
  }, [isPlacingEpicenter, isSimulationRunning]);

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
      map.current.fitBounds(DEFAULT_MAP_BOUNDS, { ...DEFAULT_MAP_FIT_OPTIONS, duration: 2000 });
    });

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
      applyBoundaryTheme(map.current, useStore.getState().mapStyle);
      restoreSimulationAfterStyleLoad(map.current);
      restoreTsunamiWaveAfterStyleLoad(map.current);
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
      animationManager.stopTsunamiWave();
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
        animationManager.stopTsunamiWave();
        
        map.current.setStyle(styleJson);
      } catch (err) {
        console.error("Failed to load map style:", err);
      }
    };
    applyStyle();
  }, [mapStyle]);

  // Sync GIS layer visibility
  useEffect(() => {
    if (!map.current || !map.current.getStyle()) return;
    if (!mapLayerService.initialized) {
      mapLayerService.initializeSourcesAndLayers(map.current, gisLayers);
    }
    Object.keys(gisLayers).forEach(layerKey => {
      mapLayerService.setLayerVisibility(layerKey, gisLayers[layerKey]);
    });
    applyBoundaryTheme(map.current, mapStyle);
    refreshVisibleLegendItems(map.current);
  }, [gisLayers, mapStyle]);

  // Update epicenter marker
  useEffect(() => {
    if (!map.current || !map.current.getStyle()) return;
    const source = map.current.getSource('sim-epicenter-source');
    if (!source) return;

    if (!earthquakeEpicenter) {
      source.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    source.setData(buildEpicenterFeatureCollection(earthquakeEpicenter));
  }, [earthquakeEpicenter]);

  // Keep the retained live event list visible as persistent red map dots.
  useEffect(() => {
    if (!map.current || !map.current.getStyle()) return;
    syncLiveEarthquakesSource(map.current, liveEvents);
    mapLayerService.bringSimulationLayersToFront(map.current);
    refreshVisibleLegendItems(map.current);
  }, [liveEvents]);

  // Loop tsunami-specific wavefronts while a confirmed tsunami warning is active.
  useEffect(() => {
    if (!map.current || !map.current.getStyle()) return;

    if (activeTsunamiWarning?.tsunami_warning?.is_warning) {
      animationManager.startTsunamiWave(map.current, activeTsunamiWarning);
      mapLayerService.bringSimulationLayersToFront(map.current);
    } else {
      animationManager.stopTsunamiWave();
    }
  }, [activeTsunamiWarning]);

  // Switch between PGA/damage and MMI intensity heatmap modes
  useEffect(() => {
    if (!map.current || !map.current.getStyle()) return;
    setSimulationHeatmapMode(map.current, Boolean(simulationResults), intensityVisible);
    refreshVisibleLegendItems(map.current);
  }, [intensityVisible, simulationResults]);


  // Render simulation results and trigger shockwave
  useEffect(() => {
    if (!map.current) return;
    let styleWaitInterval = null;

    const updateSimulationResults = () => {
      try {
        const wbGridSrc = map.current.getSource('sim-wb-grid-source');
        const contourSrc = map.current.getSource('sim-contour-source');
        const intensityContourSrc = map.current.getSource('sim-intensity-contour-source');
        if (!wbGridSrc || !contourSrc) return;

        if (!simulationResults) {
          // simulationResults=null means simulation was just triggered or cleared
          debugLog('[MapView] simulationResults cleared — hiding layers and clearing data');
          setSimulationHeatmapMode(map.current, false, intensityVisible);
          refreshVisibleLegendItems(map.current);
          
          const emptyFC = { type: 'FeatureCollection', features: [] };
          if (wbGridSrc) wbGridSrc.setData(emptyFC);
          if (contourSrc) contourSrc.setData(emptyFC);
          if (intensityContourSrc) intensityContourSrc.setData(emptyFC);

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
        if (intensityContourSrc) {
          intensityContourSrc.setData(simulationResults.intensity_contour_geojson || { type: 'FeatureCollection', features: [] });
        }
        
        setSimulationHeatmapMode(map.current, true, intensityVisible);
        mapLayerService.bringSimulationLayersToFront(map.current);
        refreshVisibleLegendItems(map.current);
        debugLog('[MapView] Heatmap mode:', intensityVisible ? 'intensity' : 'pga');

        const pendingInfoPanel = useStore.getState().pendingSimulationInfoPanel;
        if (pendingInfoPanel) {
          useStore.getState().setInfoPanel(pendingInfoPanel);
          useStore.getState().clearPendingSimulationInfoPanel();
        }

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
  }, [simulationResults, pendingSimulationInfoPanel, earthquakeEpicenter, intensityVisible]);

  return (
    <div className="absolute inset-0 z-0">
      <div
        ref={mapContainer}
        className={`w-full h-full ${
          isPlacingEpicenter
            ? 'cursor-crosshair'
            : isSimulationRunning
              ? 'cursor-wait'
              : 'cursor-grab active:cursor-grabbing'
        }`}
      />
      <div className="absolute bottom-10 right-2 z-20 flex  overflow-hidden rounded border border-white/10 bg-slate-800/90 shadow-2xl backdrop-blur pointer-events-auto">
        <button
          type="button"
          onClick={zoomOut}
          className="flex h-10 w-11 items-center justify-center text-slate-100 transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-300"
          aria-label="Zoom out"
          title="Zoom out"
        >
          <ZoomOut className="h-5 w-5" strokeWidth={2.2} />
        </button>
        <button
          type="button"
          onClick={resetMapView}
          className="flex h-10 w-11 items-center justify-center border-x border-white/10 text-slate-100 transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-300"
          aria-label="Reset map view"
          title="Reset map view"
        >
          <Home className="h-5 w-5" strokeWidth={2.2} />
        </button>
        <button
          type="button"
          onClick={zoomIn}
          className="flex h-10 w-11 items-center justify-center text-slate-100 transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-300"
          aria-label="Zoom in"
          title="Zoom in"
        >
          <ZoomIn className="h-5 w-5" strokeWidth={2.2} />
        </button>
      </div>
      {/* Cinematic vignette overlay */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-slate-950/30 to-slate-950/90 mix-blend-multiply" />
    </div>
  );
}
