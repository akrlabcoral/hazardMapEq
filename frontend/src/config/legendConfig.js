import { getHazard, getHazardLegendItems } from '../hazards/registry';

export const SHARED_LEGEND_ITEMS = [
  {
    id: 'tectonicPlates',
    label: 'Tectonic plate boundaries',
    type: 'line',
    color: '#ea580c',
    layerIds: ['tectonic-plates-line'],
    requiresRenderedFeature: true,
  },
  {
    id: 'gpsVectors',
    label: 'GPS Velocity Vectors',
    type: 'group',
    items: [
      { label: 'GPS Station (Anchor Point)', type: 'circle', color: '#3b82f6', strokeColor: '#000000' },
      { label: 'Line length ∝ Velocity\nArrow indicates drift direction', type: 'arrowLine', color: '#3b82f6' },
    ],
    layerIds: ['gps-vectors-circle', 'gps-vectors-line', 'gps-vectors-head'],
    requiresRenderedFeature: true,
  },
  {
    id: 'landCover',
    label: 'ESA WorldCover 2021 Land Cover',
    type: 'palette',
    palette: [
      { label: 'Tree Cover', color: '#006400' },
      { label: 'Shrubland', color: '#ffbb22' },
      { label: 'Grassland', color: '#ffff4c' },
      { label: 'Cropland', color: '#f096ff' },
      { label: 'Built-up', color: '#fa0000' },
      { label: 'Bare / Sparse Vegetation', color: '#b4b4b4' },
      { label: 'Snow & Ice', color: '#f0f0f0' },
      { label: 'Water Bodies', color: '#0064c8' },
      { label: 'Herbaceous Wetland', color: '#0096a0' },
      { label: 'Mangroves', color: '#00cf75' },
      { label: 'Moss & Lichen', color: '#fae6a0' },
    ],
    layerIds: ['land-cover'],
    requiresRenderedFeature: false,
  },
];

export const getLegendItems = (activeHazard) => [
  ...(getHazard(activeHazard)?.legendItems || []),
  ...SHARED_LEGEND_ITEMS,
];

export const getLegendItemById = (itemId, activeHazard) => (
  getLegendItems(activeHazard).find((item) => item.id === itemId)
  || getHazardLegendItems().find((item) => item.id === itemId)
  || SHARED_LEGEND_ITEMS.find((item) => item.id === itemId)
  || null
);

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

export const getVisibleLegendItemIds = (mapInstance, activeHazard) => {
  if (!mapInstance?.getStyle()) return [];

  return getLegendItems(activeHazard)
    .filter((item) => {
      const visibleLayerIds = item.layerIds.filter((layerId) => isLayerVisibleAtZoom(mapInstance, layerId));
      if (!visibleLayerIds.length) return false;
      if (!item.requiresRenderedFeature) return true;
      return hasRenderedFeature(mapInstance, visibleLayerIds);
    })
    .map((item) => item.id);
};
