import { buildTsunamiFeatureInfoPanel } from './infoPanels';
import { TSUNAMI_LAYERS } from './layerMetadata';

export const tsunamiInspectionProvider = {
  hazardType: 'tsunami',
  inspectors: [
    {
      id: 'tsunami',
      layerIds: [TSUNAMI_LAYERS.marker],
      inspect: buildTsunamiFeatureInfoPanel,
    },
  ],
};

