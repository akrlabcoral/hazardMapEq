import { create } from 'zustand';
import { createUiSlice } from './slices/uiSlice';
import { createSimulationSlice } from './slices/simulationSlice';
import { createMapSlice } from './slices/mapSlice';
import { createRasterSlice } from './slices/rasterSlice';
import { createLiveEventsSlice } from './slices/liveEventsSlice';

const useStore = create((set, get, api) => ({
  ...createUiSlice(set, get, api),
  ...createSimulationSlice(set, get, api),
  ...createMapSlice(set, get, api),
  ...createRasterSlice(set, get, api),
  ...createLiveEventsSlice(set, get, api),
}));

export default useStore;
