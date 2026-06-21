import React, { useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import { Home, ZoomIn, ZoomOut } from 'lucide-react';
import useStore from '../store/useStore';
import { mapLayerService } from '../services/mapLayerService';
import { rasterService } from '../services/rasterService';
import {
  buildEpicenterFeatureCollection,
  renderSimulationResults,
  restoreSimulationAfterStyleLoad,
  setSimulationHeatmapMode,
  syncLiveEarthquakesSource,
} from '../hazards/earthquake';
import {
  bringTsunamiLayersToFront,
  initTsunamiLayers,
  setTsunamiLayerVisibility,
  syncTsunamiSource,
} from '../hazards/tsunami';

import { animationManager } from '../services/animationManager';

import {
  initSimulationLayers,
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
  const activeHazard = useStore((state) => state.activeHazard);
  const tsunamiResult = useStore((state) => state.tsunamiResult);
  const tsunamiSource = useStore((state) => state.tsunamiSource);

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
      initTsunamiLayers(map.current);
      mapLayerService.initializeSourcesAndLayers(map.current, useStore.getState().gisLayers);
      applyBoundaryTheme(map.current, useStore.getState().mapStyle);
      restoreSimulationAfterStyleLoad({
        mapInstance: map.current,
        store: useStore.getState(),
        refreshVisibleLegendItems,
      });
      syncTsunamiSource(map.current, useStore.getState().tsunamiResult, useStore.getState().tsunamiSource);
      setTsunamiLayerVisibility(
        map.current,
        useStore.getState().activeHazard === 'tsunami' && Boolean(useStore.getState().tsunamiResult && useStore.getState().tsunamiSource)
      );
      bringTsunamiLayersToFront(map.current);
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

  useEffect(() => {
    if (!map.current || !map.current.getStyle()) return;
    syncTsunamiSource(map.current, tsunamiResult, tsunamiSource);
    setTsunamiLayerVisibility(map.current, activeHazard === 'tsunami' && Boolean(tsunamiResult && tsunamiSource));
    mapLayerService.bringSimulationLayersToFront(map.current);
    bringTsunamiLayersToFront(map.current);
    refreshVisibleLegendItems(map.current);
  }, [activeHazard, tsunamiResult, tsunamiSource]);

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
      renderSimulationResults({
        mapInstance: map.current,
        simulationResults,
        earthquakeEpicenter,
        intensityVisible,
        getStoreState: useStore.getState,
        refreshVisibleLegendItems,
      });
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
