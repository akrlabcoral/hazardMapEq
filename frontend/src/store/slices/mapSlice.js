export const createMapSlice = (set) => ({
  infoPanel: null,
  setInfoPanel: (infoPanel) => set({ infoPanel }),
  clearInfoPanel: () => set({ infoPanel: null }),
  pendingSimulationInfoPanel: null,
  setPendingSimulationInfoPanel: (infoPanel) => set({ pendingSimulationInfoPanel: infoPanel }),
  clearPendingSimulationInfoPanel: () => set({ pendingSimulationInfoPanel: null }),

  visibleLegendItems: [],
  setVisibleLegendItems: (visibleLegendItems) => set({ visibleLegendItems }),

  stateIdMapping: null,
  setStateIdMapping: (mapping) => set({ stateIdMapping: mapping }),
  


  gisLayers: { satellite: false, terrain: false, indiaBoundary: true, stateBoundaries: true, tectonicPlates: true, gpsVectors: false, historicEarthquakes: false },
  toggleGisLayer: (layer) => set((state) => ({ gisLayers: { ...state.gisLayers, [layer]: !state.gisLayers[layer] } })),
  historicMinMag: 4.0,
  setHistoricMinMag: (magnitude) => set({ historicMinMag: magnitude }),

  intensityVisible: false,
  setIntensityVisible: (val) => set({ intensityVisible: val }),

  mapViewport: { longitude: 77.96, latitude: 25.59, zoom: 9 },
  setMapViewport: (viewport) => set({ mapViewport: viewport }),
});
