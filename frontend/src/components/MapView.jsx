import React, { useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import useStore from '../store/useStore';
import { mapLayerService } from '../services/mapLayerService';
import { rasterService } from '../services/rasterService';
import { mapLayerManager } from '../services/mapLayerManager';
import { animationManager } from '../services/animationManager';

// Layer IDs for simulation visualization
const SIM_LAYERS = {
  WB_GRID_FILL:   'sim-wb-grid-fill',
  CONTOUR_FILL:   'sim-contour-fill',
  CONTOUR_STROKE: 'sim-contour-stroke',
  SHOCKWAVE:      'sim-shockwave',
  EPICENTER:      'sim-epicenter',
  SOIL_AMP:       'sim-soil-amp-layer',
};

export default function MapView() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const mapViewport = useStore((state) => state.mapViewport);
  
  const earthquakeEpicenter    = useStore((state) => state.earthquakeEpicenter);
  const setEarthquakeEpicenter = useStore((state) => state.setEarthquakeEpicenter);
  const setIsSimulationRunning = useStore((state) => state.setIsSimulationRunning);
  const selectedStateName      = useStore((state) => state.selectedStateName);
  
  const gisLayers      = useStore((state) => state.gisLayers);
  const layerOpacities = useStore((state) => state.layerOpacities);
  const soilAmpVisible = useStore((state) => state.soilAmpVisible);
  
  const simulationResults = useStore((state) => state.simulationResults);
  const mapStyle          = useStore((state) => state.mapStyle);

  // Initialize simulation sources and layers on a loaded map
  const initSimulationLayers = useCallback((mapInstance) => {
    const emptyFC = { type: 'FeatureCollection', features: [] };

    mapLayerManager.addSourceSafe(mapInstance, 'sim-wb-grid-source',    { type: 'geojson', data: emptyFC });
    mapLayerManager.addSourceSafe(mapInstance, 'sim-contour-source',    { type: 'geojson', data: emptyFC });
    mapLayerManager.addSourceSafe(mapInstance, 'sim-shockwave-source',  { type: 'geojson', data: emptyFC });
    mapLayerManager.addSourceSafe(mapInstance, 'sim-epicenter-source',  { type: 'geojson', data: emptyFC });

    // --- Soil Amplification Choropleth (Vs30 Site Classification) ---
    // Clipped to heatmap footprint: only cells with meaningful PGA are rendered.
    // Rendered from soil_factor property: blue (Site A/hard rock) → red (Site E/soft soil)
    mapLayerManager.addLayerSafe(mapInstance, {
      id: SIM_LAYERS.SOIL_AMP,
      type: 'fill',
      source: 'sim-wb-grid-source',
      layout: { visibility: 'none' }, // hidden until user enables toggle
      // Only show cells inside the shaking footprint (pga_base > 0.001g)
      filter: ['>', ['get', 'pga_base'], 0.001],
      paint: {
        'fill-color': [
          'interpolate', ['linear'], ['get', 'soil_factor'],
          0.80, '#1e40af',  // deep blue  → Site A (Hard Rock, de-amplifies)
          1.00, '#3b82f6',  // blue       → Site B (Rock, neutral)
          1.20, '#22c55e',  // green      → Site C (Dense Soil)
          1.40, '#f97316',  // orange     → Site D (Stiff Soil)
          1.70, '#ef4444',  // red        → Site E (Soft Clay, max amplification)
        ],
        'fill-opacity': 0.75,
      }
    }, SIM_LAYERS.WB_GRID_FILL);

    // --- Popup tooltip for grid cells (shows vs30 + site_class) ---
    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false });
    mapInstance.on('mousemove', SIM_LAYERS.SOIL_AMP, (e) => {
      if (!e.features?.length) return;
      mapInstance.getCanvas().style.cursor = 'crosshair';
      const p = e.features[0].properties;
      const siteColors = { A: '#3b82f6', B: '#60a5fa', C: '#22c55e', D: '#f97316', E: '#ef4444' };
      const cls = p.site_class || '–';
      const color = siteColors[cls] || '#94a3b8';
      popup.setLngLat(e.lngLat).setHTML(`
        <div style="background:#0f172a;border:1px solid #334155;padding:10px 14px;border-radius:10px;font-family:monospace;font-size:12px;color:#e2e8f0;min-width:160px">
          <div style="font-weight:700;font-size:13px;border-bottom:1px solid #334155;padding-bottom:6px;margin-bottom:8px;color:#fff">Soil Site Data</div>
          <div style="display:flex;justify-content:space-between;margin-bottom:4px">
            <span style="color:#94a3b8">Vs30:</span>
            <span style="color:#22d3ee;font-weight:600">${p.vs30 ?? '–'} m/s</span>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:4px">
            <span style="color:#94a3b8">Site Class:</span>
            <span style="color:${color};font-weight:700">NEHRP ${cls}</span>
          </div>
          <div style="display:flex;justify-content:space-between">
            <span style="color:#94a3b8">Amplification:</span>
            <span style="color:#a78bfa;font-weight:600">${p.soil_factor ?? '–'}×</span>
          </div>
        </div>
      `).addTo(mapInstance);
    });
    mapInstance.on('mouseleave', SIM_LAYERS.SOIL_AMP, () => {
      mapInstance.getCanvas().style.cursor = '';
      popup.remove();
    });


    // --- Hazard Grid Fill (Choropleth by fused_hazard score) ---
    mapLayerManager.addLayerSafe(mapInstance, {
      id: SIM_LAYERS.WB_GRID_FILL,
      type: 'fill',
      source: 'sim-wb-grid-source',
      paint: {
        'fill-color': [
          'interpolate', ['linear'], ['get', 'fused_hazard'],
          0.0, 'rgba(34, 197, 94, 0.0)',
          0.2, 'rgba(34, 197, 94, 0.5)',
          0.4, 'rgba(234, 179, 8, 0.6)',
          0.6, 'rgba(249, 115, 22, 0.7)',
          0.8, 'rgba(239, 68, 68, 0.8)',
          1.0, 'rgba(185, 28, 28, 0.95)',
        ],
        'fill-outline-color': 'rgba(255, 255, 255, 0.1)',
      }
    });

    // --- Smooth PGA Contour fill overlay ---
    // fill-opacity must be embedded in the rgba color — data-driven fill-opacity
    // is not reliably supported in all MapLibre versions.
    mapLayerManager.addLayerSafe(mapInstance, {
      id: SIM_LAYERS.CONTOUR_FILL,
      type: 'fill',
      source: 'sim-contour-source',
      paint: {
        // Build rgba by appending 0.55 alpha to the fill hex from the GeoJSON
        'fill-color': [
          'case',
          ['has', 'fill'], ['get', 'fill'],
          'rgba(0,0,0,0)'
        ],
        'fill-opacity': 0.55,
      }
    });

    // --- Contour stroke (band boundaries) ---
    mapLayerManager.addLayerSafe(mapInstance, {
      id: SIM_LAYERS.CONTOUR_STROKE,
      type: 'line',
      source: 'sim-contour-source',
      paint: {
        'line-color': [
          'case',
          ['has', 'stroke'], ['get', 'stroke'],
          '#ffffff'
        ],
        'line-width': 1.5,
        'line-opacity': 0.85,
      }
    });

    // --- Shockwave (animated ring) ---
    mapLayerManager.addLayerSafe(mapInstance, {
      id: SIM_LAYERS.SHOCKWAVE,
      type: 'line',
      source: 'sim-shockwave-source',
      paint: {
        'line-color': '#ef4444',
        'line-width': 3,
        'line-opacity': 0.6
      }
    });

    // --- Epicenter atmospheric glow ---
    mapLayerManager.addLayerSafe(mapInstance, {
      id: 'sim-epicenter-glow',
      type: 'circle',
      source: 'sim-epicenter-source',
      paint: {
        'circle-radius': 22,
        'circle-color': 'rgba(239, 68, 68, 0.25)',
        'circle-blur': 0.8,
        'circle-stroke-width': 0
      }
    });

    // --- Epicenter outer ring ---
    mapLayerManager.addLayerSafe(mapInstance, {
      id: 'sim-epicenter-ring',
      type: 'circle',
      source: 'sim-epicenter-source',
      paint: {
        'circle-radius': 14,
        'circle-color': 'rgba(239, 68, 68, 0.4)',
        'circle-blur': 0.4,
        'circle-stroke-width': 1.5,
        'circle-stroke-color': 'rgba(255, 255, 255, 0.3)'
      }
    });

    // --- Epicenter marker ---
    mapLayerManager.addLayerSafe(mapInstance, {
      id: SIM_LAYERS.EPICENTER,
      type: 'circle',
      source: 'sim-epicenter-source',
      paint: {
        'circle-radius': 8,
        'circle-color': '#ef4444',
        'circle-stroke-width': 3,
        'circle-stroke-color': '#ffffff'
      }
    });

  }, []);

  useEffect(() => {
    animationManager.setStoreActions(setIsSimulationRunning);
  }, [setIsSimulationRunning]);

  useEffect(() => {
    if (map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'osm-dark': {
            type: 'raster',
            tiles: [
              'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
              'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
              'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png'
            ],
            tileSize: 256,
            attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a>'
          },
          'osm-light': {
            type: 'raster',
            tiles: [
              'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
              'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
              'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png'
            ],
            tileSize: 256,
            attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a>'
          }
        },
        layers: [
          {
            id: 'osm-dark-layer',
            type: 'raster',
            source: 'osm-dark',
            minzoom: 0,
            maxzoom: 22,
            layout: { visibility: 'visible' }
          },
          {
            id: 'osm-light-layer',
            type: 'raster',
            source: 'osm-light',
            minzoom: 0,
            maxzoom: 22,
            layout: { visibility: 'none' }
          }
        ]
      },
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
      if (e.originalEvent && e.originalEvent.button === 1) { // Middle mouse button
        e.originalEvent.preventDefault();
        const coords = { lng: e.lngLat.lng, lat: e.lngLat.lat };
        console.log('[Epicenter] Middle-click => setting epicenter:', coords);
        setEarthquakeEpicenter(coords);
      }
    };
    
    map.current.on('click', onMapClick);
    map.current.on('mousedown', onMouseDown);

    map.current.on('style.load', () => {
      initSimulationLayers(map.current);
      mapLayerService.initializeSourcesAndLayers(map.current, useStore.getState().gisLayers);
      rasterService.setMap(map.current);

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
      });
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

  // Sync Map Theme (Dark/Light)
  useEffect(() => {
    if (!map.current || !map.current.getStyle()) return;
    if (mapLayerManager.layerExists(map.current, 'osm-dark-layer')) {
      map.current.setLayoutProperty('osm-dark-layer', 'visibility', mapStyle === 'dark' ? 'visible' : 'none');
    }
    if (mapLayerManager.layerExists(map.current, 'osm-light-layer')) {
      map.current.setLayoutProperty('osm-light-layer', 'visibility', mapStyle === 'light' ? 'visible' : 'none');
    }
  }, [mapStyle]);

  // Sync GIS layer visibility
  useEffect(() => {
    if (!map.current || !mapLayerService.initialized) return;
    Object.entries(gisLayers).forEach(([key, isVisible]) => {
      mapLayerService.setLayerVisibility(key, isVisible);
    });
  }, [gisLayers]);

  // Sync layer opacities
  useEffect(() => {
    if (!map.current || !mapLayerService.initialized) return;
    Object.entries(layerOpacities).forEach(([key, opacity]) => {
      mapLayerService.setLayerOpacity(key, opacity);
    });
  }, [layerOpacities]);

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
    if (mapLayerManager.layerExists(map.current, SIM_LAYERS.SOIL_AMP)) {
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
    
    if (mapLayerManager.layerExists(map.current, SIM_LAYERS.WB_GRID_FILL)) {
      map.current.setFilter(SIM_LAYERS.WB_GRID_FILL, filter);
    }
    if (mapLayerManager.layerExists(map.current, SIM_LAYERS.CONTOUR_FILL)) {
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
          // simulationResults=null means simulation was just triggered — hide layers immediately
          console.log('[MapView] simulationResults cleared — hiding layers (sim in progress)');
          if (map.current.getLayer(SIM_LAYERS.CONTOUR_FILL))   map.current.setLayoutProperty(SIM_LAYERS.CONTOUR_FILL,   'visibility', 'none');
          if (map.current.getLayer(SIM_LAYERS.CONTOUR_STROKE)) map.current.setLayoutProperty(SIM_LAYERS.CONTOUR_STROKE, 'visibility', 'none');
          if (map.current.getLayer(SIM_LAYERS.WB_GRID_FILL))   map.current.setLayoutProperty(SIM_LAYERS.WB_GRID_FILL,   'visibility', 'none');
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

    if (map.current.isStyleLoaded()) {
      updateSimulationResults();
    } else {
      map.current.once('styledata', updateSimulationResults);
    }
  }, [simulationResults, earthquakeEpicenter]);

  return (
    <div className="absolute inset-0 z-0">
      <div ref={mapContainer} className={`w-full h-full ${useStore((state) => state.isPlacingEpicenter) ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`} />
      {/* Cinematic vignette overlay */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-slate-950/30 to-slate-950/90 mix-blend-multiply" />
    </div>
  );
}
