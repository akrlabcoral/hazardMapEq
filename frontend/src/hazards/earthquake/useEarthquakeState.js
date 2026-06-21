import { useShallow } from 'zustand/react/shallow';
import useStore from '../../store/useStore';

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
  })));
}
