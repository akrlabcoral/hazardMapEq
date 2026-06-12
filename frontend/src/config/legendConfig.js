import { SIM_LAYERS } from './simulationLayers';

export const LEGEND_ITEMS = [
  {
    id: 'epicenter',
    layerIds: [SIM_LAYERS.EPICENTER],
    requiresRenderedFeature: true,
  },
  {
    id: 'historicEarthquakes',
    layerIds: ['historic-clusters', 'historic-unclustered-point'],
    requiresRenderedFeature: true,
  },
  {
    id: 'liveEarthquakes',
    layerIds: ['live-earthquake-point', 'live-earthquakes-point', 'live-event-point', 'live-events-point'],
    requiresRenderedFeature: true,
  },
  {
    id: 'tectonicPlates',
    layerIds: ['tectonic-plates-line'],
    requiresRenderedFeature: true,
  },
  {
    id: 'gpsVectors',
    layerIds: ['gps-vectors-circle', 'gps-vectors-line', 'gps-vectors-head'],
    requiresRenderedFeature: true,
  },
  {
    id: 'pgaIntensity',
    layerIds: [SIM_LAYERS.CONTOUR_FILL, SIM_LAYERS.WB_GRID_FILL],
    requiresRenderedFeature: true,
  },
  {
    id: 'soilAmplification',
    layerIds: [SIM_LAYERS.SOIL_AMP],
    requiresRenderedFeature: true,
  },
];

const isLayerVisibleAtZoom = (mapInstance, layerId) => {
  const layer = mapInstance.getLayer(layerId);
  if (!layer) return false;

  const visibility = mapInstance.getLayoutProperty(layerId, 'visibility');
  if (visibility === 'none') return false;

  const zoom = mapInstance.getZoom();
  const minzoom = layer.minzoom ?? 0;
  const maxzoom = layer.maxzoom ?? 24;
  return zoom >= minzoom && zoom < maxzoom;
};

const hasRenderedFeature = (mapInstance, layerIds) => {
  try {
    return mapInstance.queryRenderedFeatures({ layers: layerIds }).length > 0;
  } catch (_err) {
    return false;
  }
};

export const getVisibleLegendItemIds = (mapInstance) => {
  if (!mapInstance?.getStyle()) return [];

  return LEGEND_ITEMS
    .filter((item) => {
      const visibleLayerIds = item.layerIds.filter((layerId) => isLayerVisibleAtZoom(mapInstance, layerId));
      if (!visibleLayerIds.length) return false;
      if (!item.requiresRenderedFeature) return true;
      return hasRenderedFeature(mapInstance, visibleLayerIds);
    })
    .map((item) => item.id);
};
