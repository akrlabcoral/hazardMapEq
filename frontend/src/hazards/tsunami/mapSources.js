import { mapLayerService } from '../../services/mapLayerService';
import { TSUNAMI_LAYERS, TSUNAMI_SOURCES } from './layerMetadata';

const EMPTY_FEATURE_COLLECTION = { type: 'FeatureCollection', features: [] };

export const buildTsunamiFeatureCollection = (result, source) => ({
  type: 'FeatureCollection',
  features: source ? [{
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [source.lng, source.lat] },
    properties: {
      result: result ? JSON.stringify(result) : '',
      level: result?.tsunami_potential_class?.level || '',
      description: result?.tsunami_potential_class?.description || '',
    },
  }] : [],
});

export const initTsunamiLayers = (mapInstance) => {
  mapLayerService.addSourceSafe(mapInstance, TSUNAMI_SOURCES.source, {
    type: 'geojson',
    data: EMPTY_FEATURE_COLLECTION,
  });

  mapLayerService.addSourceSafe(mapInstance, TSUNAMI_SOURCES.ttt, {
    type: 'geojson',
    data: EMPTY_FEATURE_COLLECTION,
  });

  mapLayerService.addSourceSafe(mapInstance, TSUNAMI_SOURCES.wavefront, {
    type: 'geojson',
    data: EMPTY_FEATURE_COLLECTION,
  });

  mapLayerService.addLayerSafe(mapInstance, {
    id: TSUNAMI_LAYERS.tttFill,
    type: 'fill',
    source: TSUNAMI_SOURCES.ttt,
    layout: { visibility: 'none' },
    paint: {
      'fill-color': ['get', 'fill'],
      'fill-opacity': ['coalesce', ['get', 'fill-opacity'], 0.35],
    },
    filter: ['==', '$type', 'Polygon'],
  });

  mapLayerService.addLayerSafe(mapInstance, {
    id: TSUNAMI_LAYERS.tttLine,
    type: 'line',
    source: TSUNAMI_SOURCES.ttt,
    layout: { visibility: 'none' },
    paint: {
      'line-color': ['coalesce', ['get', 'stroke'], '#ffffff'],
      'line-width': 1.5,
      'line-opacity': 0.7,
    },
    filter: ['==', '$type', 'LineString'],
  });

  mapLayerService.addLayerSafe(mapInstance, {
    id: TSUNAMI_LAYERS.tttLabels,
    type: 'symbol',
    source: TSUNAMI_SOURCES.ttt,
    layout: {
      visibility: 'none',
      'symbol-placement': 'line',
      'text-field': ['get', 'travel_time_hours'],
      'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
      'text-size': 12,
      'text-allow-overlap': false,
    },
    paint: {
      'text-color': '#000000',
      'text-halo-color': '#ffffff',
      'text-halo-width': 1.5,
    },
    filter: ['==', '$type', 'LineString'],
  });

  mapLayerService.addLayerSafe(mapInstance, {
    id: TSUNAMI_LAYERS.markerGlow,
    type: 'circle',
    source: TSUNAMI_SOURCES.source,
    layout: {
      visibility: 'none',
    },
    paint: {
      'circle-radius': 24,
      'circle-color': '#38bdf8',
      'circle-opacity': 0.22,
      'circle-blur': 0.8,
    },
  });

  mapLayerService.addLayerSafe(mapInstance, {
    id: TSUNAMI_LAYERS.marker,
    type: 'circle',
    source: TSUNAMI_SOURCES.source,
    layout: {
      visibility: 'none',
    },
    paint: {
      'circle-radius': 9,
      'circle-color': '#0ea5e9',
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 2,
    },
  });

  mapLayerService.addLayerSafe(mapInstance, {
    id: TSUNAMI_LAYERS.wavefrontGlow,
    type: 'line',
    source: TSUNAMI_SOURCES.wavefront,
    layout: { visibility: 'none' },
    paint: {
      'line-color': '#22d3ee',
      'line-width': ['coalesce', ['get', 'glowWidth'], 7],
      'line-opacity': ['coalesce', ['get', 'glowOpacity'], 0.28],
      'line-blur': 2.5,
    },
  });

  mapLayerService.addLayerSafe(mapInstance, {
    id: TSUNAMI_LAYERS.wavefrontLine,
    type: 'line',
    source: TSUNAMI_SOURCES.wavefront,
    layout: { visibility: 'none' },
    paint: {
      'line-color': '#ffffff',
      'line-width': ['coalesce', ['get', 'width'], 2.5],
      'line-opacity': ['coalesce', ['get', 'opacity'], 0.85],
      'line-blur': 0.15,
    },
  });
};

export const setTsunamiLayerVisibility = (mapInstance, { markerVisible, resultVisible, wavefrontVisible }) => {
  if (!mapInstance?.getStyle()) return;
  const setVisibility = (layerIds, isVisible) => {
    const visibility = isVisible ? 'visible' : 'none';
    layerIds.forEach((layerId) => {
      if (mapInstance.getLayer(layerId)) {
        mapInstance.setLayoutProperty(layerId, 'visibility', visibility);
      }
    });
  };

  setVisibility([
    TSUNAMI_LAYERS.markerGlow,
    TSUNAMI_LAYERS.marker
  ], markerVisible);

  setVisibility([TSUNAMI_LAYERS.tttFill], resultVisible);
  setVisibility([
    TSUNAMI_LAYERS.tttLine,
    TSUNAMI_LAYERS.tttLabels
  ], resultVisible);

  setVisibility([
    TSUNAMI_LAYERS.wavefrontGlow,
    TSUNAMI_LAYERS.wavefrontLine
  ], wavefrontVisible);
};

export const syncTsunamiSource = (mapInstance, result, source) => {
  if (!mapInstance?.getStyle()) return;
  const mapSource = mapInstance.getSource(TSUNAMI_SOURCES.source);
  if (mapSource?.setData) {
    mapSource.setData(buildTsunamiFeatureCollection(result, source));
  }
  const tttSource = mapInstance.getSource(TSUNAMI_SOURCES.ttt);
  if (tttSource?.setData) {
    tttSource.setData(result?.layers?.travel_time_contours || EMPTY_FEATURE_COLLECTION);
  }
};

export const bringTsunamiLayersToFront = (mapInstance) => {
  if (!mapInstance?.getStyle()) return;
  [
    TSUNAMI_LAYERS.tttFill,
    TSUNAMI_LAYERS.tttLine,
    TSUNAMI_LAYERS.tttLabels,
    TSUNAMI_LAYERS.wavefrontGlow,
    TSUNAMI_LAYERS.wavefrontLine,
    TSUNAMI_LAYERS.markerGlow, 
    TSUNAMI_LAYERS.marker
  ].forEach((layerId) => {
    if (mapInstance.getLayer(layerId)) {
      mapInstance.moveLayer(layerId);
    }
  });
};
