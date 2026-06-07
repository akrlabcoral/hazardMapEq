import { create } from 'zustand';
import { BUILT_IN_RASTERS } from '../config/rasterRegistry';
import { HAZARD_LAYERS } from '../services/layerCapabilities';

const useStore = create((set) => ({
  isSidebarOpen: false,
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  
  activeSection: null,
  setActiveSection: (section) => set((state) => ({ activeSection: state.activeSection === section ? null : section })),
  forceActiveSection: (section) => set({ activeSection: section }),

  activeRightSection: null,
  setActiveRightSection: (section) => set((state) => ({ activeRightSection: state.activeRightSection === section ? null : section })),

  mapStyle: 'light',
  toggleMapStyle: () => set((state) => ({ mapStyle: state.mapStyle === 'dark' ? 'light' : 'dark' })),

  // Earthquake Simulation State
  isPlacingEpicenter: false,
  setIsPlacingEpicenter: (val) => set({ isPlacingEpicenter: val }),
  
  earthquakeEpicenter: null, // { lng, lat }
  setEarthquakeEpicenter: (epicenter) => set({ earthquakeEpicenter: epicenter }),
  
  epicenterRegion: null,
  setEpicenterRegion: (region) => set({ epicenterRegion: region }),
  
  earthquakeMagnitude: 5.0,
  setEarthquakeMagnitude: (magnitude) => set({ earthquakeMagnitude: magnitude }),
  
  earthquakeDepth: 10, // km, range 1-100
  setEarthquakeDepth: (depth) => set({ earthquakeDepth: depth }),
  
  // Advanced GMPE Parameters
  useCustomGmpe: false,
  setUseCustomGmpe: (val) => set({ useCustomGmpe: val }),
  gmpeParams: {
    c1: 1.35,
    c2: 0.5,
    c3: 0.0,
    c4: -0.005,
    C: 1.0
  },
  updateGmpeParam: (key, value) => set((state) => ({
    gmpeParams: { ...state.gmpeParams, [key]: value }
  })),
  
  // Modular Hazard Layers state
  hazardLayers: HAZARD_LAYERS.reduce((acc, layer) => {
    acc[layer.id] = { active: layer.available, weight: layer.defaultWeight };
    return acc;
  }, {}),
  toggleHazardLayer: (id) => set((state) => ({
    hazardLayers: {
      ...state.hazardLayers,
      [id]: { ...state.hazardLayers[id], active: !state.hazardLayers[id].active }
    }
  })),
  setHazardLayerWeight: (id, weight) => set((state) => ({
    hazardLayers: {
      ...state.hazardLayers,
      [id]: { ...state.hazardLayers[id], weight }
    }
  })),
  
  // Simulation results from engine
  simulationResults: null,
  setSimulationResults: (results) => set({ simulationResults: results }),
  
  isSimulationRunning: false,
  setIsSimulationRunning: (val) => set({ isSimulationRunning: val }),

  // State Analysis UI
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

  // GIS Layer visibility — simplified to boundary and base layers only
  gisLayers: {
    satellite: false,
    terrain: false,
    indiaBoundary: true,
    stateBoundaries: true,
    tectonicPlates: true,
  },
  toggleGisLayer: (layer) => set((state) => ({
    gisLayers: { ...state.gisLayers, [layer]: !state.gisLayers[layer] }
  })),

  // Soil Amplification overlay visibility (toggled from Map Layers panel)
  soilAmpVisible: false,
  setSoilAmpVisible: (val) => set({ soilAmpVisible: val }),


  // Dynamic Raster Layers State
  rasterLayers: [...BUILT_IN_RASTERS],
  addRasterLayer: (layer) => set((state) => ({ rasterLayers: [...state.rasterLayers, layer] })),
  updateRasterLayerLoaded: (id, isLoaded) => set((state) => ({
    rasterLayers: state.rasterLayers.map(l => l.id === id ? { ...l, isLoaded } : l)
  })),
  removeRasterLayer: (id) => set((state) => ({ 
    rasterLayers: state.rasterLayers.filter(l => l.id !== id) 
  })),
  updateRasterLayerVisibility: (id, visible) => set((state) => ({
    rasterLayers: state.rasterLayers.map(l => l.id === id ? { ...l, visible } : l)
  })),

  // File Upload Queue State
  uploadQueue: [], // { id, fileName, loadedBytes, totalBytes, status, error, abortController }
  addUploadTask: (task) => set((state) => ({ uploadQueue: [...state.uploadQueue, task] })),
  updateUploadTask: (id, updates) => set((state) => ({
    uploadQueue: state.uploadQueue.map(t => t.id === id ? { ...t, ...updates } : t)
  })),
  removeUploadTask: (id) => set((state) => ({
    uploadQueue: state.uploadQueue.filter(t => t.id !== id)
  })),
  
  mapViewport: {
    longitude: 88.36,
    latitude: 22.57,
    zoom: 8
  },
  setMapViewport: (viewport) => set({ mapViewport: viewport }),


  // Centralized cleanup for simulation state and map overlays
  clearSimulationState: () => set((state) => ({
    earthquakeEpicenter: null,
    simulationResults: null,
    isSimulationRunning: false,
    selectedStateName: null,
    activeAlert: null,
  })),

  // ── Real-Time Live Events ─────────────────────────────────────────
  liveEvents: [],   // newest first, capped at 50
  setLiveEvents: (events) => set({ liveEvents: events }),
  addLiveEvent: (event) => set((s) => ({
    liveEvents: [event, ...s.liveEvents].slice(0, 50),
  })),
  clearLiveEvents: () => set({ liveEvents: [] }),

  // Alert banner — shown for M≥6.0 events
  activeAlert: null,
  setActiveAlert: (event) => set({ activeAlert: event }),
  dismissAlert: () => set({ activeAlert: null }),

  // WebSocket connection status
  wsConnected: false,
  setWsConnected: (val) => set({ wsConnected: val }),

  // Auto-simulation toggle — prevent auto-sim from overwriting active manual sim
  autoSimEnabled: true,
  setAutoSimEnabled: (val) => set({ autoSimEnabled: val }),
}));


export default useStore;
