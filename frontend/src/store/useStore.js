import { create } from 'zustand';
import { getHazardStateSlices } from '../hazards/stateRegistry';
import { createHazardSlice } from './slices/hazardSlice';
import { createUiSlice } from './slices/uiSlice';
import { createMapSlice } from './slices/mapSlice';
import { createRasterSlice } from './slices/rasterSlice';
import { createLiveEventsSlice } from './slices/liveEventsSlice';

const createRegisteredHazardSlices = (set, get, api) => getHazardStateSlices().reduce(
  (state, createSlice) => ({ ...state, ...createSlice(set, get, api) }),
  {}
);

const useStore = create((set, get, api) => ({
  ...createHazardSlice(set, get, api),
  ...createUiSlice(set, get, api),
  ...createMapSlice(set, get, api),
  ...createRasterSlice(set, get, api),
  ...createLiveEventsSlice(set, get, api),
  ...createRegisteredHazardSlices(set, get, api),
}));

export default useStore;
