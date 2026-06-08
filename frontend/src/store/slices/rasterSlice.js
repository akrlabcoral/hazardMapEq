import { BUILT_IN_RASTERS } from '../../config/rasterRegistry';

export const createRasterSlice = (set) => ({
  rasterLayers: [...BUILT_IN_RASTERS],
  addRasterLayer: (layer) => set((state) => ({ rasterLayers: [...state.rasterLayers, layer] })),
  updateRasterLayerLoaded: (id, isLoaded) => set((state) => ({ rasterLayers: state.rasterLayers.map(l => l.id === id ? { ...l, isLoaded } : l) })),
  removeRasterLayer: (id) => set((state) => ({ rasterLayers: state.rasterLayers.filter(l => l.id !== id) })),
  updateRasterLayerVisibility: (id, visible) => set((state) => ({ rasterLayers: state.rasterLayers.map(l => l.id === id ? { ...l, visible } : l) })),

  uploadQueue: [],
  addUploadTask: (task) => set((state) => ({ uploadQueue: [...state.uploadQueue, task] })),
  updateUploadTask: (id, updates) => set((state) => ({ uploadQueue: state.uploadQueue.map(t => t.id === id ? { ...t, ...updates } : t) })),
  removeUploadTask: (id) => set((state) => ({ uploadQueue: state.uploadQueue.filter(t => t.id !== id) })),
});
