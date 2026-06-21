import {
  buildHistoricEarthquakeFeatureInfoPanel,
  buildLiveEarthquakeFeatureInfoPanel,
} from './infoPanels';
import { EARTHQUAKE_LAYERS } from './layerMetadata';

export const earthquakeInspectionProvider = {
  hazardType: 'earthquake',
  inspectors: [
    {
      id: 'historicCluster',
      layerIds: [EARTHQUAKE_LAYERS.historicClusters, EARTHQUAKE_LAYERS.historicClusterCount],
      inspect: () => null,
    },
    {
      id: 'historicEarthquake',
      layerIds: [EARTHQUAKE_LAYERS.historicPoint],
      inspect: buildHistoricEarthquakeFeatureInfoPanel,
    },
    {
      id: 'liveEarthquake',
      layerIds: [EARTHQUAKE_LAYERS.livePoint, ...EARTHQUAKE_LAYERS.legacyLivePointIds],
      inspect: buildLiveEarthquakeFeatureInfoPanel,
    },
  ],
};
