import { mapLayerService } from '../services/mapLayerService';
import {
  EARTHQUAKE_DAMAGE_FILL_COLOR,
  EARTHQUAKE_DAMAGE_FILL_OPACITY,
} from './damagePalette';

// Layer IDs for simulation visualization
export const SIM_LAYERS = {
  WB_GRID_FILL:   'sim-wb-grid-fill',
  INTENSITY_FILL: 'sim-intensity-fill',
  CONTOUR_FILL:   'sim-contour-fill',
  CONTOUR_STROKE: 'sim-contour-stroke',
  SHOCKWAVE:      'sim-shockwave',
  EPICENTER:      'sim-epicenter',
};

export const LIVE_EARTHQUAKE_SOURCE = 'live-earthquakes-source';
export const TSUNAMI_WAVE_SOURCE = 'tsunami-wave-source';

export const LIVE_EARTHQUAKE_LAYERS = {
  PULSE: 'live-earthquake-pulse',
  POINT: 'live-earthquake-point',
};

export const TSUNAMI_WAVE_LAYERS = {
  GLOW: 'tsunami-wavefront-glow',
  LINES: 'tsunami-wavefront-lines',
  LABELS: 'tsunami-wavefront-labels',
};

export const initSimulationLayers = (mapInstance) => {
  const emptyFC = { type: 'FeatureCollection', features: [] };

  mapLayerService.addSourceSafe(mapInstance, 'sim-wb-grid-source',    { type: 'geojson', data: emptyFC });
  mapLayerService.addSourceSafe(mapInstance, 'sim-contour-source',    { type: 'geojson', data: emptyFC });
  mapLayerService.addSourceSafe(mapInstance, 'sim-intensity-contour-source', { type: 'geojson', data: emptyFC });
  mapLayerService.addSourceSafe(mapInstance, 'sim-shockwave-source',  { type: 'geojson', data: emptyFC });
  mapLayerService.addSourceSafe(mapInstance, 'sim-epicenter-source',  { type: 'geojson', data: emptyFC });
  mapLayerService.addSourceSafe(mapInstance, LIVE_EARTHQUAKE_SOURCE,  { type: 'geojson', data: emptyFC });
  mapLayerService.addSourceSafe(mapInstance, TSUNAMI_WAVE_SOURCE,     { type: 'geojson', data: emptyFC });

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

  // --- Smooth MMI intensity contour, derived from local PGA using the configured MMI formula ---
  mapLayerService.addLayerSafe(mapInstance, {
    id: SIM_LAYERS.INTENSITY_FILL,
    type: 'fill',
    source: 'sim-intensity-contour-source',
    layout: { visibility: 'none' },
    paint: {
      'fill-color': [
        'case',
        ['has', 'fill'], ['get', 'fill'],
        'rgba(0,0,0,0)'
      ],
      'fill-opacity': [
        'case',
        ['has', 'fill-opacity'], ['get', 'fill-opacity'],
        0.4
      ],
      'fill-outline-color': 'rgba(15, 23, 42, 0.18)',
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

  // --- Tsunami warning wavefronts ---
  mapLayerService.addLayerSafe(mapInstance, {
    id: TSUNAMI_WAVE_LAYERS.GLOW,
    type: 'line',
    source: TSUNAMI_WAVE_SOURCE,
    filter: ['==', ['get', 'geomType'], 'LineString'],
    paint: {
      'line-color': '#38bdf8',
      'line-width': ['coalesce', ['get', 'glowWidth'], 7],
      'line-opacity': ['coalesce', ['get', 'glowOpacity'], 0.25],
    }
  });

  mapLayerService.addLayerSafe(mapInstance, {
    id: TSUNAMI_WAVE_LAYERS.LINES,
    type: 'line',
    source: TSUNAMI_WAVE_SOURCE,
    filter: ['==', ['get', 'geomType'], 'LineString'],
    paint: {
      'line-color': '#ffffff',
      'line-width': ['coalesce', ['get', 'lineWidth'], 2],
      'line-opacity': ['coalesce', ['get', 'lineOpacity'], 0.85],
    }
  });

  mapLayerService.addLayerSafe(mapInstance, {
    id: TSUNAMI_WAVE_LAYERS.LABELS,
    type: 'symbol',
    source: TSUNAMI_WAVE_SOURCE,
    filter: ['==', ['get', 'geomType'], 'Point'],
    layout: {
      'text-field': ['get', 'label'],
      'text-size': 11,
      'text-font': ['Open Sans Bold', 'Open Sans Regular'],
      'text-allow-overlap': true,
      'text-ignore-placement': true,
    },
    paint: {
      'text-color': '#ffffff',
      'text-halo-color': '#0369a1',
      'text-halo-width': 1.5,
      'text-opacity': ['coalesce', ['get', 'labelOpacity'], 0.85],
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

  // --- Persistent live earthquake epicenters ---
  mapLayerService.addLayerSafe(mapInstance, {
    id: LIVE_EARTHQUAKE_LAYERS.PULSE,
    type: 'circle',
    source: LIVE_EARTHQUAKE_SOURCE,
    filter: ['==', ['get', 'is_relevant'], true],
    paint: {
      'circle-radius': [
        'interpolate', ['linear'], ['coalesce', ['get', 'magnitude'], 0],
        0, 8,
        5, 14,
        9.5, 22,
      ],
      'circle-color': 'rgba(239, 68, 68, 0.24)',
      'circle-blur': 0.65,
      'circle-opacity': 0.8,
      'circle-stroke-width': 0,
    }
  });

  mapLayerService.addLayerSafe(mapInstance, {
    id: LIVE_EARTHQUAKE_LAYERS.POINT,
    type: 'symbol',
    source: LIVE_EARTHQUAKE_SOURCE,
    layout: {
      'icon-image': 'star-icon',
      'icon-size': [
        'interpolate', ['linear'], ['coalesce', ['get', 'magnitude'], 0],
        0, 0.45,
        4, 0.65,
        6, 0.85,
        9.5, 1.1,
      ],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
  });
};
