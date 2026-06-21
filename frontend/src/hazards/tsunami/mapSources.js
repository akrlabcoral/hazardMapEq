import { mapLayerService } from '../../services/mapLayerService';
import { TSUNAMI_LAYERS, TSUNAMI_SOURCES } from './layerMetadata';

const EMPTY_FEATURE_COLLECTION = { type: 'FeatureCollection', features: [] };

export const buildTsunamiFeatureCollection = (result, source) => ({
  type: 'FeatureCollection',
  features: result && source ? [{
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [source.lng, source.lat] },
    properties: {
      result: JSON.stringify(result),
      level: result.tsunami_potential_class?.level || '',
      description: result.tsunami_potential_class?.description || '',
    },
  }] : [],
});

export const initTsunamiLayers = (mapInstance) => {
  mapLayerService.addSourceSafe(mapInstance, TSUNAMI_SOURCES.source, {
    type: 'geojson',
    data: EMPTY_FEATURE_COLLECTION,
  });

  mapLayerService.addLayerSafe(mapInstance, {
    id: TSUNAMI_LAYERS.markerGlow,
    type: 'circle',
    source: TSUNAMI_SOURCES.source,
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
    paint: {
      'circle-radius': 9,
      'circle-color': [
        'match',
        ['get', 'level'],
        'Very Low', '#22c55e',
        'Low', '#eab308',
        'Moderate', '#f97316',
        'High', '#ef4444',
        'Very High', '#7f1d1d',
        '#38bdf8',
      ],
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 2,
    },
  });
};

export const syncTsunamiSource = (mapInstance, result, source) => {
  if (!mapInstance?.getStyle()) return;
  const mapSource = mapInstance.getSource(TSUNAMI_SOURCES.source);
  if (mapSource?.setData) {
    mapSource.setData(buildTsunamiFeatureCollection(result, source));
  }
};

export const bringTsunamiLayersToFront = (mapInstance) => {
  if (!mapInstance?.getStyle()) return;
  [TSUNAMI_LAYERS.markerGlow, TSUNAMI_LAYERS.marker].forEach((layerId) => {
    if (mapInstance.getLayer(layerId)) {
      mapInstance.moveLayer(layerId);
    }
  });
};
