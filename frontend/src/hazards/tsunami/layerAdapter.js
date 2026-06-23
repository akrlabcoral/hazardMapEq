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
      {
        markerVisible: isActive && Boolean(store.tsunamiSource),
        resultVisible: isActive && Boolean(store.tsunamiResult && store.tsunamiSource),
        wavefrontVisible: isActive && Boolean(store.tsunamiSource && (store.isTsunamiAnalysisRunning || store.tsunamiResult)),
      }
    );
  },

  bringToFront(mapInstance) {
    bringTsunamiLayersToFront(mapInstance);
  },

  getVisibleLayers(store) {
    if (!store.tsunamiSource) return [];
    const markerLayers = [TSUNAMI_LAYERS.markerGlow, TSUNAMI_LAYERS.marker];
    const waveLayers = store.isTsunamiAnalysisRunning || store.tsunamiResult
      ? [TSUNAMI_LAYERS.wavefrontGlow, TSUNAMI_LAYERS.wavefrontLine]
      : [];
    const resultLayers = store.tsunamiResult
      ? [TSUNAMI_LAYERS.tttFill, TSUNAMI_LAYERS.tttLine, TSUNAMI_LAYERS.tttLabels]
      : [];
    return [...resultLayers, ...waveLayers, ...markerLayers];
  },

  getLayerMetadata() {
    return {
      sources: TSUNAMI_SOURCES,
      layers: TSUNAMI_LAYERS,
    };
  },
};
