import { mapLayerService } from '../services/mapLayerService';
import {
  EARTHQUAKE_DAMAGE_FILL_COLOR,
  EARTHQUAKE_DAMAGE_FILL_OPACITY,
} from './damagePalette';

// Layer IDs for simulation visualization
export const SIM_LAYERS = {
  WB_GRID_FILL:   'sim-wb-grid-fill',
  CONTOUR_FILL:   'sim-contour-fill',
  CONTOUR_STROKE: 'sim-contour-stroke',
  SHOCKWAVE:      'sim-shockwave',
  EPICENTER:      'sim-epicenter',
  SOIL_AMP:       'sim-soil-amp-layer',
};

export const initSimulationLayers = (mapInstance) => {
  const emptyFC = { type: 'FeatureCollection', features: [] };

  mapLayerService.addSourceSafe(mapInstance, 'sim-wb-grid-source',    { type: 'geojson', data: emptyFC });
  mapLayerService.addSourceSafe(mapInstance, 'sim-contour-source',    { type: 'geojson', data: emptyFC });
  mapLayerService.addSourceSafe(mapInstance, 'sim-shockwave-source',  { type: 'geojson', data: emptyFC });
  mapLayerService.addSourceSafe(mapInstance, 'sim-epicenter-source',  { type: 'geojson', data: emptyFC });

  // --- Soil Amplification Choropleth (Vs30 Site Classification) ---
  mapLayerService.addLayerSafe(mapInstance, {
    id: SIM_LAYERS.SOIL_AMP,
    type: 'fill',
    source: 'sim-wb-grid-source',
    layout: { visibility: 'none' }, // hidden until user enables toggle
    filter: ['>', ['get', 'pga_base'], 0.001],
    paint: {
      'fill-color': [
        'interpolate', ['linear'], ['get', 'soil_factor'],
        0.80, '#1e40af',  // Site A
        1.00, '#3b82f6',  // Site B
        1.20, '#22c55e',  // Site C
        1.40, '#f97316',  // Site D
        1.70, '#ef4444',  // Site E
      ],
      'fill-opacity': 0.75,
    }
  }, SIM_LAYERS.WB_GRID_FILL);

  // --- Damage grid fill (normalized fused_hazard: 0.0 least damage, 1.0 most damage) ---
  mapLayerService.addLayerSafe(mapInstance, {
    id: SIM_LAYERS.WB_GRID_FILL,
    type: 'fill',
    source: 'sim-wb-grid-source',
    paint: {
      'fill-color': EARTHQUAKE_DAMAGE_FILL_COLOR,
      'fill-opacity': EARTHQUAKE_DAMAGE_FILL_OPACITY,
      'fill-outline-color': 'rgba(255, 255, 255, 0.1)',
    }
  });

  // --- Smooth PGA Contour fill overlay ---
  mapLayerService.addLayerSafe(mapInstance, {
    id: SIM_LAYERS.CONTOUR_FILL,
    type: 'fill',
    source: 'sim-contour-source',
    paint: {
      'fill-color': [
        'case',
        ['has', 'fill'], ['get', 'fill'],
        'rgba(0,0,0,0)'
      ],
      'fill-opacity': 0.82,
    }
  });

  // --- Contour stroke (band boundaries) ---
  mapLayerService.addLayerSafe(mapInstance, {
    id: SIM_LAYERS.CONTOUR_STROKE,
    type: 'line',
    source: 'sim-contour-source',
    paint: {
      'line-color': [
        'case',
        ['has', 'stroke'], ['get', 'stroke'],
        '#ffffff'
      ],
      'line-width': 2,
      'line-opacity': 0.95,
    }
  });

  // --- Shockwave (animated ring) ---
  mapLayerService.addLayerSafe(mapInstance, {
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
  mapLayerService.addLayerSafe(mapInstance, {
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
  mapLayerService.addLayerSafe(mapInstance, {
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

  if (!mapInstance.hasImage('star-icon')) {
    const img = new Image();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#ff0000" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    img.onload = () => {
      if (!mapInstance.hasImage('star-icon')) {
        mapInstance.addImage('star-icon', img);
      }
    };
  }

  // --- Epicenter marker ---
  mapLayerService.addLayerSafe(mapInstance, {
    id: SIM_LAYERS.EPICENTER,
    type: 'symbol',
    source: 'sim-epicenter-source',
    layout: {
      'icon-image': 'star-icon',
      'icon-size': 1.0,
      'icon-allow-overlap': true,
      'icon-ignore-placement': true
    }
  });
};
