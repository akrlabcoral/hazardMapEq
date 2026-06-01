// src/hooks/useEarthquakeState.js
// Custom selector hook — groups all earthquake simulation state together.
// useShallow prevents re-render when unrelated store keys change.

import { useShallow } from 'zustand/react/shallow';
import useStore from '../store/useStore';

export function useEarthquakeState() {
  return useStore(useShallow((s) => ({
    epicenter:      s.earthquakeEpicenter,
    setEpicenter:   s.setEarthquakeEpicenter,
    magnitude:      s.earthquakeMagnitude,
    setMagnitude:   s.setEarthquakeMagnitude,
    depth:          s.earthquakeDepth,
    setDepth:       s.setEarthquakeDepth,
    isPlacing:      s.isPlacingEpicenter,
    setIsPlacing:   s.setIsPlacingEpicenter,
    gmpeParams:     s.gmpeParams,
    updateGmpeParam: s.updateGmpeParam,
    useCustomGmpe:   s.useCustomGmpe,
    setUseCustomGmpe: s.setUseCustomGmpe,
    epicenterRegion:  s.epicenterRegion,
    setEpicenterRegion: s.setEpicenterRegion,
  })));
}
