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
  {
    id: 'tsunamiTTT',
    label: 'Travel Time (Hours)',
    type: 'palette',
    layerIds: [TSUNAMI_LAYERS.tttFill, TSUNAMI_LAYERS.tttLine],
    requiresRenderedFeature: true,
    palette: [
      { color: '#d73027', label: '0-2' },
      { color: '#fdae61', label: '2-5' },
      { color: '#e0f3f8', label: '5-10' },
      { color: '#74add1', label: '10-20' },
      { color: '#313695', label: '20+' }
    ],
  },
];
