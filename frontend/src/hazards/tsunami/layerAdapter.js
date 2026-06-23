import {
  bringTsunamiLayersToFront,
  initTsunamiLayers,
  setTsunamiLayerVisibility,
  syncTsunamiSource,
} from './mapSources';
import { TSUNAMI_LAYERS, TSUNAMI_SOURCES } from './layerMetadata';

export const tsunamiLayerAdapter = {
  hazardType: 'tsunami',

  registerLayers(mapInstance) {
    initTsunamiLayers(mapInstance);
  },

  syncLayers(mapInstance, store) {
    syncTsunamiSource(mapInstance, store.tsunamiResult, store.tsunamiSource);
  },

  setVisibility(mapInstance, isActive, store) {
    setTsunamiLayerVisibility(
      mapInstance,
      isActive && Boolean(store.tsunamiResult && store.tsunamiSource)
    );
  },

  bringToFront(mapInstance) {
    bringTsunamiLayersToFront(mapInstance);
  },

  getVisibleLayers(store) {
    return store.tsunamiResult && store.tsunamiSource
      ? [TSUNAMI_LAYERS.tttFill, TSUNAMI_LAYERS.tttLine, TSUNAMI_LAYERS.tttLabels, TSUNAMI_LAYERS.markerGlow, TSUNAMI_LAYERS.marker]
      : [];
  },

  getLayerMetadata() {
    return {
      sources: TSUNAMI_SOURCES,
      layers: TSUNAMI_LAYERS,
    };
  },
};
