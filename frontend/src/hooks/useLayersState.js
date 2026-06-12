// src/hooks/useLayersState.js
// Custom selector hook — groups all layer visibility/opacity state together.

import { useShallow } from 'zustand/react/shallow';
import useStore from '../store/useStore';

export function useLayersState() {
  return useStore(useShallow((s) => ({
    gisLayers:        s.gisLayers,
    toggleGisLayer:   s.toggleGisLayer,
    soilAmpVisible:   s.soilAmpVisible,
    setSoilAmpVisible: s.setSoilAmpVisible,
    hazardLayers:     s.hazardLayers,
    toggleHazardLayer: s.toggleHazardLayer,
    setHazardLayerWeight: s.setHazardLayerWeight,
  })));
}
