import { EARTHQUAKE_LAYERS } from './layerMetadata';

export const EARTHQUAKE_LEGEND_ITEMS = [
  {
    id: 'epicenter',
    layerIds: [EARTHQUAKE_LAYERS.epicenter],
    requiresRenderedFeature: true,
  },
  {
    id: 'historicEarthquakes',
    layerIds: [EARTHQUAKE_LAYERS.historicClusters, EARTHQUAKE_LAYERS.historicPoint],
    requiresRenderedFeature: true,
  },
  {
    id: 'liveEarthquakes',
    layerIds: [EARTHQUAKE_LAYERS.livePoint, ...EARTHQUAKE_LAYERS.legacyLivePointIds],
    requiresRenderedFeature: true,
  },
  {
    id: 'pgaIntensity',
    layerIds: [EARTHQUAKE_LAYERS.pgaFill, EARTHQUAKE_LAYERS.gridFill],
    requiresRenderedFeature: true,
  },
  {
    id: 'mmiIntensity',
    layerIds: [EARTHQUAKE_LAYERS.intensityFill],
    requiresRenderedFeature: true,
  },
];

