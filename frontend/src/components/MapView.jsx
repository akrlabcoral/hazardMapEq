import React, { useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import { Home, ZoomIn, ZoomOut } from 'lucide-react';
import useStore from '../store/useStore';
import { mapLayerService } from '../services/mapLayerService';
import { rasterService } from '../services/rasterService';

import { animationManager } from '../services/animationManager';

import { getActiveLayerAdapter, getLayerAdapters } from '../hazards/registry';
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

const isRenderedWaterPoint = (mapInstance, point) => {
  try {
    const features = mapInstance.queryRenderedFeatures(point);
    return features.some((feature) => {
      const layerId = feature.layer?.id?.toLowerCase?.() || '';
      const sourceLayer = feature.sourceLayer?.toLowerCase?.() || '';
      const properties = Object.values(feature.properties || {}).join(' ').toLowerCase();
      const descriptor = `${layerId} ${sourceLayer} ${properties}`;
      return /(water|ocean|sea|marine)/.test(descriptor);
    });
  } catch (err) {
    return false;
  }
};

const getMapCursor = ({
  isPlacingEpicenter,
  isPlacingTsunamiEpicenter,
  isPlacingEvacuationOrigin,
  isSelectingEvacuationTarget,
  isSimulationRunning,
  isInspectableHover = false,
}) => {
  if (isPlacingEpicenter || isPlacingTsunamiEpicenter || isPlacingEvacuationOrigin || isSelectingEvacuationTarget) return 'crosshair';
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
  const nextItems = getVisibleLegendItemIds(mapInstance, useStore.getState().activeHazard);
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
  if (mapInstance.getLayer('district-boundaries-fill')) {
    mapInstance.setPaintProperty('district-boundaries-fill', 'fill-color', stateHoverFill);
  }
  if (mapInstance.getLayer('district-boundaries-line')) {
    mapInstance.setPaintProperty('district-boundaries-line', 'line-color', [
      'case',
      ['boolean', ['feature-state', 'hover'], false],
      stateHoverFill,
      boundaryLine,
    ]);
  }
};

const flattenCoordinates = (coordinates, points = []) => {
  if (!Array.isArray(coordinates)) return points;
  if (typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
    points.push(coordinates);
    return points;
  }
  coordinates.forEach((child) => flattenCoordinates(child, points));
  return points;
};

const getFeatureCenter = (feature, fallbackLngLat) => {
  const points = flattenCoordinates(feature?.geometry?.coordinates);
  if (!points.length) return { lng: fallbackLngLat.lng, lat: fallbackLngLat.lat };
  const bounds = points.reduce((acc, [lng, lat]) => ({
    minLng: Math.min(acc.minLng, lng),
    maxLng: Math.max(acc.maxLng, lng),
    minLat: Math.min(acc.minLat, lat),
    maxLat: Math.max(acc.maxLat, lat),
  }), {
    minLng: Infinity,
    maxLng: -Infinity,
    minLat: Infinity,
    maxLat: -Infinity,
  });
  return {
    lng: (bounds.minLng + bounds.maxLng) / 2,
    lat: (bounds.minLat + bounds.maxLat) / 2,
  };
};

const isHighRiskGridFeature = (feature) => {
  const properties = feature?.properties || {};
  const category = String(
    properties.risk_category
    || properties.riskLevel
    || properties.risk_level
    || properties.severity
    || ''
  ).toLowerCase();
  if (/(high|very high|extreme|severe)/.test(category)) return true;

  const pga = Number(properties.local_pga ?? properties.final_pga ?? properties.pga);
  const mmi = Number(properties.mmi ?? properties.intensity);
  const riskScore = Number(properties.risk_score ?? properties.risk);
  return (
    (Number.isFinite(pga) && pga >= 0.215)
    || (Number.isFinite(mmi) && mmi >= 7)
    || (Number.isFinite(riskScore) && riskScore >= 0.7)
  );
};

const createHazardLayerContext = () => ({
  getStoreState: useStore.getState,
  refreshVisibleLegendItems,
});

const registerHazardLayers = (mapInstance) => {
  const context = createHazardLayerContext();
  getLayerAdapters().forEach((adapter) => {
    adapter.registerLayers(mapInstance, context);
  });
};

const syncHazardLayers = (mapInstance, options = {}) => {
  if (!mapInstance?.getStyle()) return;
  const store = useStore.getState();
  const activeAdapter = getActiveLayerAdapter(store.activeHazard);
  const context = {
    ...createHazardLayerContext(),
    ...options,
  };

  getLayerAdapters().forEach((adapter) => {
    adapter.syncLayers(mapInstance, store, context);
    adapter.setVisibility(mapInstance, adapter === activeAdapter, store, context);
  });

  activeAdapter?.bringToFront(mapInstance, context);
  refreshVisibleLegendItems(mapInstance);
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
  const activePanel       = useStore((state) => state.activePanel);
  const isPlacingEpicenter = useStore((state) => state.isPlacingEpicenter);
  const isPlacingTsunamiEpicenter = useStore((state) => state.isPlacingTsunamiEpicenter);
  const isPlacingEvacuationOrigin = useStore((state) => state.isPlacingEvacuationOrigin);
  const isSelectingEvacuationTarget = useStore((state) => state.isSelectingEvacuationTarget);
  const isSimulationRunning = useStore((state) => state.isSimulationRunning);
  const liveEvents = useStore((state) => state.liveEvents);
  const activeHazard = useStore((state) => state.activeHazard);
  const tsunamiResult = useStore((state) => state.tsunamiResult);
  const tsunamiSource = useStore((state) => state.tsunamiSource);
  const isTsunamiAnalysisRunning = useStore((state) => state.isTsunamiAnalysisRunning);
  const evacuationOrigin = useStore((state) => state.evacuationOrigin);
  const evacuationTarget = useStore((state) => state.evacuationTarget);
  const evacuationPlan = useStore((state) => state.evacuationPlan);
  const autoEvacuationPlans = useStore((state) => state.autoEvacuationPlans);

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
  }, [isPlacingEpicenter, isPlacingTsunamiEpicenter, isPlacingEvacuationOrigin, isSelectingEvacuationTarget, isSimulationRunning]);

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

      if (useStore.getState().isPlacingTsunamiEpicenter) {
        const coords = { lng: e.lngLat.lng, lat: e.lngLat.lat };
        debugLog('[Tsunami] Map click => setting tsunami epicenter:', coords);
        const store = useStore.getState();
        if (!isRenderedWaterPoint(map.current, e.point)) {
          store.setTsunamiAnalysisError('Tsunami source must be in an ocean/water cell.');
          return;
        }
        // Tsunami epicenter placement is independent from earthquake placement.
        // Clear stale tsunami outputs so old travel-time layers do not remain on a new source.
        store.setTsunamiSource(coords);
        store.setTsunamiSimulationForm({
          latitude: String(coords.lat),
          longitude: String(coords.lng),
        });
        store.setTsunamiResult(null);
        store.setTsunamiAnalysisResult(null);
        store.setTsunamiAnalysisLayers(null);
        store.setTsunamiAnalysisRequestId(null);
        store.setTsunamiAnalysisStatus('idle');
        store.setTsunamiAnalysisError('');
        store.setIsPlacingTsunamiEpicenter(false);
        return;
      }

      if (useStore.getState().isPlacingEvacuationOrigin) {
        const coords = { lng: e.lngLat.lng, lat: e.lngLat.lat };
        const store = useStore.getState();
        store.setEvacuationOrigin(coords);
        store.setEvacuationPlan(null);
        store.setEvacuationError('');
        store.setIsPlacingEvacuationOrigin(false);
        return;
      }

      if (useStore.getState().isSelectingEvacuationTarget) {
        const store = useStore.getState();
        const gridLayers = ['sim-wb-grid-fill', 'sim-intensity-fill']
          .filter((layerId) => map.current.getLayer(layerId));
        const features = gridLayers.length
          ? map.current.queryRenderedFeatures(e.point, { layers: gridLayers })
          : [];
        const feature = features.find(isHighRiskGridFeature);
        if (!feature) {
          store.setEvacuationError('Select a high-risk simulation grid cell.');
          return;
        }
        store.setEvacuationTarget({
          ...getFeatureCenter(feature, e.lngLat),
          risk_category: feature.properties?.risk_category || feature.properties?.risk_level || feature.properties?.severity || '',
          state: feature.properties?.state || feature.properties?.STATE || '',
        });
        store.setEvacuationPlan(null);
        store.setEvacuationError('');
        store.setIsSelectingEvacuationTarget(false);
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
      registerHazardLayers(map.current);
      mapLayerService.initializeSourcesAndLayers(map.current, useStore.getState().gisLayers);
      applyBoundaryTheme(map.current, useStore.getState().mapStyle);
      syncHazardLayers(map.current, { isStyleLoad: true });
      const currentStore = useStore.getState();
      if (
        currentStore.activeHazard === 'tsunami'
        && currentStore.tsunamiSource
        && currentStore.isTsunamiAnalysisRunning
      ) {
        animationManager.startTsunamiWavefront(map.current, currentStore.tsunamiSource);
      }
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

        let hoveredDistrictId = null;
        map.current.on('mousemove', 'district-boundaries-fill', (e) => {
          if (e.features.length > 0) {
            const feature = e.features[0];
            if (hoveredDistrictId !== null) {
              map.current.setFeatureState(
                { source: 'district-boundaries-source', id: hoveredDistrictId },
                { hover: false }
              );
            }
            hoveredDistrictId = feature.properties.DIST_LGD ?? feature.properties.OBJECTID ?? feature.id;
            if (hoveredDistrictId !== undefined) {
              map.current.setFeatureState(
                { source: 'district-boundaries-source', id: hoveredDistrictId },
                { hover: true }
              );
            }
          }
        });

        map.current.on('mouseleave', 'district-boundaries-fill', () => {
          if (hoveredDistrictId !== null) {
            map.current.setFeatureState(
              { source: 'district-boundaries-source', id: hoveredDistrictId },
              { hover: false }
            );
          }
          hoveredDistrictId = null;
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
      animationManager.stopTsunamiWavefront();
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
  }, [setEarthquakeEpicenter, isAdmin]);

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
    syncHazardLayers(map.current);
  }, [earthquakeEpicenter]);

  // Keep the retained live event list visible as persistent red map dots.
  useEffect(() => {
    if (!map.current || !map.current.getStyle()) return;
    syncHazardLayers(map.current);
  }, [liveEvents]);

  useEffect(() => {
    if (!map.current || !map.current.getStyle()) return;
    syncHazardLayers(map.current);
  }, [activeHazard, tsunamiResult, tsunamiSource, isTsunamiAnalysisRunning, evacuationOrigin, evacuationTarget, evacuationPlan, autoEvacuationPlans]);

  useEffect(() => {
    if (!map.current || !map.current.getStyle()) return;

    if (activeHazard === 'tsunami' && tsunamiSource && isTsunamiAnalysisRunning) {
      animationManager.startTsunamiWavefront(map.current, tsunamiSource);
      return;
    }

    animationManager.stopTsunamiWavefront();
  }, [activeHazard, tsunamiSource, tsunamiResult, isTsunamiAnalysisRunning]);

  // Switch between PGA/damage and MMI intensity heatmap modes
  useEffect(() => {
    if (!map.current || !map.current.getStyle()) return;
    syncHazardLayers(map.current);
  }, [intensityVisible]);


  // Render simulation results and trigger shockwave
  useEffect(() => {
    if (!map.current) return;
    let styleWaitInterval = null;

    const updateSimulationResults = () => syncHazardLayers(map.current);

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

  const zoomControlsPosition = isAdmin && activePanel === 'workflow'
    ? 'bottom-[calc(clamp(300px,34vh,380px)+2rem)] z-30'
    : 'bottom-10 z-20';

  return (
    <div className="absolute inset-0 z-0">
      <div
        ref={mapContainer}
        className={`w-full h-full ${
          isPlacingEpicenter
          || isPlacingTsunamiEpicenter
          || isPlacingEvacuationOrigin
          || isSelectingEvacuationTarget
            ? 'cursor-crosshair'
            : isSimulationRunning
              ? 'cursor-wait'
              : 'cursor-grab active:cursor-grabbing'
        }`}
      />
      <div className={`absolute right-2 ${zoomControlsPosition} flex overflow-hidden rounded border border-white/10 bg-slate-800/90 shadow-2xl backdrop-blur pointer-events-auto`}>
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
