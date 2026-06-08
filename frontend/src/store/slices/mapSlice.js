export const createMapSlice = (set) => ({
  isHoverTooltipEnabled: false,
  setHoverTooltipEnabled: (val) => set({ isHoverTooltipEnabled: val }),
  
  hoveredStateId: null,
  setHoveredStateId: (id) => set({ hoveredStateId: id }),
  
  hoveredCellData: null,
  setHoveredCellData: (data) => set({ hoveredCellData: data }),
  
  selectedStateName: null,
  setSelectedStateName: (name) => set({ selectedStateName: name }),
  
  stateIdMapping: null,
  setStateIdMapping: (mapping) => set({ stateIdMapping: mapping }),
  
  mousePos: { x: 0, y: 0 },
  setMousePos: (pos) => set({ mousePos: pos }),

  gisLayers: { satellite: false, terrain: false, indiaBoundary: true, stateBoundaries: true, tectonicPlates: true, gpsVectors: false },
  toggleGisLayer: (layer) => set((state) => ({ gisLayers: { ...state.gisLayers, [layer]: !state.gisLayers[layer] } })),

  soilAmpVisible: false,
  setSoilAmpVisible: (val) => set({ soilAmpVisible: val }),

  mapViewport: { longitude: 88.36, latitude: 22.57, zoom: 8 },
  setMapViewport: (viewport) => set({ mapViewport: viewport }),
});
