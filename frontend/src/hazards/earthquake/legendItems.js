import { EARTHQUAKE_LAYERS } from './layerMetadata';
import { EARTHQUAKE_DAMAGE_PALETTE } from '../../config/damagePalette';
import { MMI_INTENSITY_PALETTE } from '../../config/intensityPalette';

const DAMAGE_LEGEND_PALETTE = [...EARTHQUAKE_DAMAGE_PALETTE].reverse();

export const EARTHQUAKE_LEGEND_ITEMS = [
  {
    id: 'epicenter',
    label: 'Earthquake origin point',
    type: 'symbol',
    symbol: 'star',
    color: '#dc2626',
    glowColor: 'rgb(255, 0, 0)',
    layerIds: [EARTHQUAKE_LAYERS.epicenter],
    requiresRenderedFeature: true,
  },
  {
    id: 'historicEarthquakes',
    label: 'Historic earthquakes',
    type: 'circle',
    color: '#f97316',
    strokeColor: 'rgba(255,255,255,0.8)',
    layerIds: [EARTHQUAKE_LAYERS.historicClusters, EARTHQUAKE_LAYERS.historicPoint],
    requiresRenderedFeature: true,
  },
  {
    id: 'liveEarthquakes',
    label: 'Live earthquakes',
    type: 'symbol',
    symbol: 'star',
    color: '#dc2626',
    glowColor: 'rgb(255, 0, 0)',
    layerIds: [EARTHQUAKE_LAYERS.livePoint, ...EARTHQUAKE_LAYERS.legacyLivePointIds],
    requiresRenderedFeature: true,
  },
  {
    id: 'pgaIntensity',
    label: 'Earthquake Damage',
    type: 'gradient',
    startLabel: 'Least Damage',
    endLabel: 'Most Damage',
    palette: DAMAGE_LEGEND_PALETTE,
    layerIds: [EARTHQUAKE_LAYERS.pgaFill, EARTHQUAKE_LAYERS.gridFill],
    requiresRenderedFeature: true,
  },
  {
    id: 'mmiIntensity',
    label: 'MMI Intensity',
    type: 'palette',
    columns: 3,
    palette: MMI_INTENSITY_PALETTE,
    layerIds: [EARTHQUAKE_LAYERS.intensityFill],
    requiresRenderedFeature: true,
  },
  {
    id: 'evacuationResponderRoute',
    label: 'Responder route',
    type: 'line',
    color: '#2563eb',
    layerIds: [EARTHQUAKE_LAYERS.evacuationResponderRoute],
    requiresRenderedFeature: true,
  },
  {
    id: 'evacuationHospitalRoute',
    label: 'Hospital route',
    type: 'line',
    color: '#22c55e',
    layerIds: [EARTHQUAKE_LAYERS.evacuationHospitalRoute],
    requiresRenderedFeature: true,
  },
];
