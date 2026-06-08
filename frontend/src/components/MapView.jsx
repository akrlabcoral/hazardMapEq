import React, { useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import useStore from '../store/useStore';
import { mapLayerService } from '../services/mapLayerService';
import { rasterService } from '../services/rasterService';

import { animationManager } from '../services/animationManager';

import { initSimulationLayers, attachSimulationPopups, SIM_LAYERS } from '../config/simulationLayers';

export default function MapView({ isAdmin = false }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const mapViewport = useStore((state) => state.mapViewport);
  
  const earthquakeEpicenter    = useStore((state) => state.earthquakeEpicenter);
  const setEarthquakeEpicenter = useStore((state) => state.setEarthquakeEpicenter);
  const setIsSimulationRunning = useStore((state) => state.setIsSimulationRunning);
  const selectedStateName      = useStore((state) => state.selectedStateName);
  
  const gisLayers      = useStore((state) => state.gisLayers);
  const soilAmpVisible = useStore((state) => state.soilAmpVisible);
  
  const simulationResults = useStore((state) => state.simulationResults);
  const mapStyle          = useStore((state) => state.mapStyle);

  // Initialize simulation sources and layers on a loaded map
  const setupSimulation = useCallback((mapInstance) => {
    initSimulationLayers(mapInstance);
    attachSimulationPopups(mapInstance);
  }, []);

  useEffect(() => {
    animationManager.setStoreActions(setIsSimulationRunning);
  }, [setIsSimulationRunning]);

  useEffect(() => {
    if (map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: { version: 8, sources: {}, layers: [] },
      center: [mapViewport.longitude, mapViewport.latitude],
      zoom: mapViewport.zoom,
      pitch: 0,
      bearing: 0,
      antialias: true
    });

    map.current.fitBounds([
      [68.7, 8.4],
      [97.25, 37.6]
    ], { padding: 50, duration: 1500 });

    map.current.addControl(new maplibregl.NavigationControl(), 'bottom-right');
    map.current.addControl(new maplibregl.FullscreenControl(), 'top-right');
    map.current.addControl(new maplibregl.ScaleControl(), 'bottom-left');

    const onMapClick = (e) => {
      if (useStore.getState().isPlacingEpicenter) {
        const coords = { lng: e.lngLat.lng, lat: e.lngLat.lat };
        console.log('[Epicenter] Map click => setting epicenter:', coords);
        setEarthquakeEpicenter(coords);
        useStore.getState().setIsPlacingEpicenter(false);
        // Verify store was updated
        setTimeout(() => {
          const stored = useStore.getState().earthquakeEpicenter;
          console.log('[Epicenter] Store verification (10ms later):', stored);
        }, 10);
      }
    };
    
    const onMouseDown = (e) => {
      if (!isAdmin) return;
      if (e.originalEvent && e.originalEvent.button === 1) { // Middle mouse button
        e.originalEvent.preventDefault();
        const coords = { lng: e.lngLat.lng, lat: e.lngLat.lat };
        console.log('[Epicenter] Middle-click => setting epicenter:', coords);
        setEarthquakeEpicenter(coords);
      }
    };
    
    map.current.on('click', onMapClick);
    map.current.on('mousedown', onMouseDown);

    let isMapEventsInitialized = false;

    map.current.on('style.load', () => {
      setupSimulation(map.current);
      mapLayerService.initializeSourcesAndLayers(map.current, useStore.getState().gisLayers);
      rasterService.setMap(map.current);

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
              mapping[f.properties.state || f.properties.STATE] = f.id;
            });
            useStore.getState().setStateIdMapping(mapping);
          });

        let hoveredStateId = null;
        let cellHoverTimeout = null;

        map.current.on('mousemove', 'state-boundaries-fill', (e) => {
          if (e.features.length > 0) {
            if (hoveredStateId !== null) {
              map.current.setFeatureState(
                { source: 'state-boundaries-source', id: hoveredStateId },
                { hover: false }
              );
            }
            hoveredStateId = e.features[0].id;
            map.current.setFeatureState(
              { source: 'state-boundaries-source', id: hoveredStateId },
              { hover: true }
            );
            useStore.getState().setHoveredStateId(hoveredStateId);
            useStore.getState().setMousePos({ x: e.originalEvent.clientX, y: e.originalEvent.clientY });
            
            if (cellHoverTimeout) clearTimeout(cellHoverTimeout);
            cellHoverTimeout = setTimeout(() => {
              if (!map.current || (!useStore.getState().isSimulationRunning && !useStore.getState().simulationResults)) {
                useStore.getState().setHoveredCellData(null);
                return;
              }
              try {
                const features = map.current.queryRenderedFeatures(e.point, { layers: [SIM_LAYERS.WB_GRID_FILL] });
                if (features.length > 0) {
                  useStore.getState().setHoveredCellData(features[0].properties);
                } else {
                  useStore.getState().setHoveredCellData(null);
                }
              } catch (err) {
                // Ignore if layer doesn't exist
              }
            }, 50);
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
          useStore.getState().setHoveredStateId(null);
          
          if (cellHoverTimeout) clearTimeout(cellHoverTimeout);
          useStore.getState().setHoveredCellData(null);
        });

        // Tectonic Plates Hover Logic
        let hoveredPlateId = null;
        const platePopup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10 });

        map.current.on('mousemove', 'tectonic-plates-line', (e) => {
          if (e.features.length > 0) {
            map.current.getCanvas().style.cursor = 'pointer';
            const feature = e.features[0];
            const type = feature.properties.Boundary_Type || 'Unknown';
            
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

            platePopup.setLngLat(e.lngLat).setHTML(`
              <div style="background:#0f172a;border:1px solid #334155;padding:8px 12px;border-radius:6px;font-family:monospace;font-size:12px;color:#e2e8f0;">
                <div style="color:#94a3b8;font-size:10px;text-transform:uppercase;margin-bottom:2px">Plate Boundary</div>
                <div style="color:#fb923c;font-weight:700;font-size:14px">${type}</div>
              </div>
            `).addTo(map.current);
          }
        });

        map.current.on('mouseleave', 'tectonic-plates-line', () => {
          map.current.getCanvas().style.cursor = '';
          platePopup.remove();
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
      if (map.current) {
        map.current.off('click', onMapClick);
        map.current.off('mousedown', onMouseDown);
        map.current.remove();
        map.current = null;
      }
    };
  }, [mapViewport, setEarthquakeEpicenter, initSimulationLayers]);

  // Sync Map Theme (Dark/Light) using vector styles to color the oceans light blue
  useEffect(() => {
    if (!map.current) return;
    const applyStyle = async () => {
      try {
        const url = mapStyle === 'dark' 
          ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
          : 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
        const res = await fetch(url);
        const styleJson = await res.json();
        
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
    if (!map.current || !mapLayerService.initialized) return;
    Object.entries(gisLayers).forEach(([key, isVisible]) => {
      mapLayerService.setLayerVisibility(key, isVisible);
    });
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
  }, [selectedStateName]);

  // Render simulation results and trigger shockwave
  useEffect(() => {
    if (!map.current) return;

    const updateSimulationResults = () => {
      try {
        const wbGridSrc = map.current.getSource('sim-wb-grid-source');
        const contourSrc = map.current.getSource('sim-contour-source');
        if (!wbGridSrc || !contourSrc) return;

        if (!simulationResults) {
          // simulationResults=null means simulation was just triggered or cleared
          console.log('[MapView] simulationResults cleared — hiding layers and clearing data');
          if (map.current.getLayer(SIM_LAYERS.CONTOUR_FILL))   map.current.setLayoutProperty(SIM_LAYERS.CONTOUR_FILL,   'visibility', 'none');
          if (map.current.getLayer(SIM_LAYERS.CONTOUR_STROKE)) map.current.setLayoutProperty(SIM_LAYERS.CONTOUR_STROKE, 'visibility', 'none');
          if (map.current.getLayer(SIM_LAYERS.WB_GRID_FILL))   map.current.setLayoutProperty(SIM_LAYERS.WB_GRID_FILL,   'visibility', 'none');
          
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
        console.log('[MapView] Rendering new simulation results. Current store epicenter:', currentEpicenter);
        console.log('[MapView] Grid features count:', simulationResults.grid_geojson.features?.length);

        wbGridSrc.setData(simulationResults.grid_geojson);
        if (simulationResults.contour_geojson) {
          contourSrc.setData(simulationResults.contour_geojson);
        }
        
        if (map.current.getLayer(SIM_LAYERS.CONTOUR_FILL))   map.current.setLayoutProperty(SIM_LAYERS.CONTOUR_FILL,   'visibility', 'visible');
        if (map.current.getLayer(SIM_LAYERS.CONTOUR_STROKE)) map.current.setLayoutProperty(SIM_LAYERS.CONTOUR_STROKE, 'visibility', 'visible');
        if (map.current.getLayer(SIM_LAYERS.WB_GRID_FILL))   map.current.setLayoutProperty(SIM_LAYERS.WB_GRID_FILL,   'visibility', 'visible');
        console.log('[MapView] Layers made visible:', SIM_LAYERS.CONTOUR_FILL, SIM_LAYERS.CONTOUR_STROKE, SIM_LAYERS.WB_GRID_FILL);

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
          console.log('[MapView] Starting shockwave at epicenter:', earthquakeEpicenter);
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
        const interval = setInterval(() => {
          attempts++;
          if (map.current && map.current.isStyleLoaded()) {
            clearInterval(interval);
            updateSimulationResults();
          } else if (attempts > 40) {
            clearInterval(interval);
            console.warn('[MapView] Style never loaded after 2s, forcing update.');
            updateSimulationResults();
          }
        }, 50);
      }
    };

    waitForStyleAndUpdate();
  }, [simulationResults, earthquakeEpicenter]);

  return (
    <div className="absolute inset-0 z-0">
      <div ref={mapContainer} className={`w-full h-full ${useStore((state) => state.isPlacingEpicenter) ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`} />
      {/* Cinematic vignette overlay */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-slate-950/30 to-slate-950/90 mix-blend-multiply" />
    </div>
  );
}
