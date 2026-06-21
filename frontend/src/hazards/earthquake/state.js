export const createSimulationSlice = (set) => ({
  isPlacingEpicenter: false,
  setIsPlacingEpicenter: (val) => set({ isPlacingEpicenter: val }),

  earthquakeEpicenter: null,
  setEarthquakeEpicenter: (epicenter) => set({ earthquakeEpicenter: epicenter }),

  earthquakeMagnitude: 5.0,
  setEarthquakeMagnitude: (magnitude) => set({ earthquakeMagnitude: magnitude }),

  earthquakeDepth: 10,
  setEarthquakeDepth: (depth) => set({ earthquakeDepth: depth }),

  simulationResults: null,
  setSimulationResults: (results) => set({ simulationResults: results }),

  isSimulationRunning: false,
  setIsSimulationRunning: (val) => set({ isSimulationRunning: val }),
  pendingSimulationRequestId: null,
  setPendingSimulationRequestId: (requestId) => set({ pendingSimulationRequestId: requestId }),

  clearSimulationState: () => set({
    earthquakeEpicenter: null,
    simulationResults: null,
    isSimulationRunning: false,
    pendingSimulationRequestId: null,
    pendingSimulationInfoPanel: null,
  }),
});
