import { TSUNAMI_LAYERS } from './layerMetadata';

export const TSUNAMI_LEGEND_ITEMS = [
  {
    id: 'tsunamiSource',
    label: 'Tsunami source',
    type: 'symbol',
    symbol: 'waves',
    color: '#06b6d4',
    glowColor: 'rgba(56,189,248,0.8)',
    layerIds: [TSUNAMI_LAYERS.marker],
    requiresRenderedFeature: true,
  },
];
