import maplibregl from 'maplibre-gl';
import { mapLayerService } from '../services/mapLayerService';

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

  // --- Hazard Grid Fill (Choropleth by fused_hazard score) ---
  mapLayerService.addLayerSafe(mapInstance, {
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
      'fill-opacity': 0.55,
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
      'line-width': 1.5,
      'line-opacity': 0.85,
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
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#ef4444" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
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

export const attachSimulationPopups = (mapInstance) => {
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
};
