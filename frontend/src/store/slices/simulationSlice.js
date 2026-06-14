import { HAZARD_LAYERS } from '../../services/layerCapabilities';

export const createSimulationSlice = (set) => ({
  isPlacingEpicenter: false,
  setIsPlacingEpicenter: (val) => set({ isPlacingEpicenter: val }),
  
  earthquakeEpicenter: null,
  setEarthquakeEpicenter: (epicenter) => set({ earthquakeEpicenter: epicenter }),
  
  epicenterRegion: null,
  setEpicenterRegion: (region) => set({ epicenterRegion: region }),
  
  earthquakeMagnitude: 5.0,
  setEarthquakeMagnitude: (magnitude) => set({ earthquakeMagnitude: magnitude }),
  
  earthquakeDepth: 10,
  setEarthquakeDepth: (depth) => set({ earthquakeDepth: depth }),
  
  useCustomGmpe: false,
  setUseCustomGmpe: (val) => set({ useCustomGmpe: val }),
  gmpeParams: { c1: 1.35, c2: 0.5, c3: 0.0, c4: -0.005, C: 1.0 },
  updateGmpeParam: (key, value) => set((state) => ({ gmpeParams: { ...state.gmpeParams, [key]: value } })),
  
  hazardLayers: HAZARD_LAYERS.reduce((acc, layer) => {
    acc[layer.id] = { active: layer.available, weight: layer.defaultWeight };
    return acc;
  }, {}),
  toggleHazardLayer: (id) => set((state) => ({
    hazardLayers: { ...state.hazardLayers, [id]: { ...state.hazardLayers[id], active: !state.hazardLayers[id].active } }
  })),
  setHazardLayerWeight: (id, weight) => set((state) => ({
    hazardLayers: { ...state.hazardLayers, [id]: { ...state.hazardLayers[id], weight } }
  })),
  
  simulationResults: null,
  setSimulationResults: (results) => set({ simulationResults: results }),
  
  isSimulationRunning: false,
  setIsSimulationRunning: (val) => set({ isSimulationRunning: val }),
  pendingSimulationRequestId: null,
  setPendingSimulationRequestId: (requestId) => set({ pendingSimulationRequestId: requestId }),
  
  clearSimulationState: () => set((state) => ({
    earthquakeEpicenter: null,
    simulationResults: null,
    isSimulationRunning: false,
    pendingSimulationRequestId: null,
    selectedStateName: null,
  })),
});
